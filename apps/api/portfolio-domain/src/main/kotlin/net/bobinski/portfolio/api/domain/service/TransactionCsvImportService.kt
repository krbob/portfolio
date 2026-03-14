package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.UUID
import net.bobinski.portfolio.api.domain.error.ResourceNotFoundException
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.CsvDateFormat
import net.bobinski.portfolio.api.domain.model.CsvDecimalSeparator
import net.bobinski.portfolio.api.domain.model.CsvDelimiter
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.TransactionImportProfile
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.TransactionImportProfileRepository

class TransactionCsvImportService(
    private val profileRepository: TransactionImportProfileRepository,
    private val accountRepository: AccountRepository,
    private val instrumentRepository: InstrumentRepository,
    private val transactionService: TransactionService
) {
    suspend fun preview(command: PreviewTransactionCsvImportCommand): TransactionImportPreview =
        parse(command.profileId, command.csv, command.skipDuplicates).preview

    suspend fun import(command: ImportTransactionCsvCommand): TransactionImportResult {
        val parsed = parse(command.profileId, command.csv, command.skipDuplicates)
        val firstInvalid = parsed.preview.rows.firstOrNull { it.status == TransactionImportRowStatus.INVALID }
        require(firstInvalid == null) { firstInvalid?.message ?: "CSV import contains invalid rows." }
        return transactionService.importAll(
            commands = parsed.parsedRows.map(ParsedCsvImportRow::command),
            skipDuplicates = parsed.skipDuplicates
        )
    }

    private suspend fun parse(
        profileId: UUID,
        csv: String,
        skipDuplicatesOverride: Boolean?
    ): ParsedCsvImport {
        val profile = profileRepository.get(profileId)
            ?: throw ResourceNotFoundException("Transaction import profile $profileId was not found.")
        val rows = parseCsv(csv, delimiterChar(profile.delimiter))
        require(rows.size >= 2) { "CSV import requires a header row and at least one data row." }

        val headerLookup = rows.first()
            .mapIndexed { index, header -> header.trim().lowercase() to index }
            .toMap()

        val accounts = accountRepository.list()
        val instruments = instrumentRepository.list()
        val accountLookup = buildAccountLookup(accounts)
        val instrumentLookup = buildInstrumentLookup(instruments)

        val parsedRows = mutableListOf<ParsedCsvImportRow>()
        val mergedPreviewRows = mutableListOf<TransactionImportPreviewRow>()

        rows.drop(1).forEachIndexed { index, row ->
            val rowNumber = index + 2
            if (row.none { it.trim().isNotEmpty() }) {
                return@forEachIndexed
            }

            try {
                parsedRows += ParsedCsvImportRow(
                    rowNumber = rowNumber,
                    command = parseCommand(
                        row = row,
                        rowNumber = rowNumber,
                        headerLookup = headerLookup,
                        profile = profile,
                        accountLookup = accountLookup,
                        instrumentLookup = instrumentLookup
                    )
                )
            } catch (exception: IllegalArgumentException) {
                mergedPreviewRows += TransactionImportPreviewRow(
                    rowNumber = rowNumber,
                    status = TransactionImportRowStatus.INVALID,
                    message = exception.message ?: "CSV row parsing failed."
                )
            }
        }

        val servicePreview = if (parsedRows.isEmpty()) {
            TransactionImportPreview(
                totalRowCount = mergedPreviewRows.size,
                importableRowCount = 0,
                duplicateRowCount = 0,
                invalidRowCount = mergedPreviewRows.size,
                rows = mergedPreviewRows
            )
        } else {
            transactionService.previewImport(parsedRows.map(ParsedCsvImportRow::command))
        }

        val validPreviewRows = servicePreview.rows.iterator()
        parsedRows.forEach { parsedRow ->
            val previewRow = validPreviewRows.next()
            mergedPreviewRows += previewRow.copy(rowNumber = parsedRow.rowNumber)
        }

        val sortedRows = mergedPreviewRows.sortedBy(TransactionImportPreviewRow::rowNumber)
        val effectiveSkipDuplicates = skipDuplicatesOverride ?: profile.skipDuplicatesByDefault

        return ParsedCsvImport(
            profile = profile,
            skipDuplicates = effectiveSkipDuplicates,
            parsedRows = parsedRows,
            preview = TransactionImportPreview(
                totalRowCount = sortedRows.size,
                importableRowCount = sortedRows.count { it.status == TransactionImportRowStatus.IMPORTABLE },
                duplicateRowCount = sortedRows.count {
                    it.status == TransactionImportRowStatus.DUPLICATE_EXISTING ||
                        it.status == TransactionImportRowStatus.DUPLICATE_BATCH
                },
                invalidRowCount = sortedRows.count { it.status == TransactionImportRowStatus.INVALID },
                rows = sortedRows
            )
        )
    }

    private fun parseCommand(
        row: List<String>,
        rowNumber: Int,
        headerLookup: Map<String, Int>,
        profile: TransactionImportProfile,
        accountLookup: Map<String, UUID>,
        instrumentLookup: Map<String, UUID>
    ): CreateTransactionCommand {
        fun valueFor(columnName: String?): String? {
            if (columnName.isNullOrBlank()) {
                return null
            }
            val index = headerLookup[columnName.trim().lowercase()]
                ?: throw IllegalArgumentException("Row $rowNumber: missing CSV header '${columnName.trim()}'.")
            return row.getOrNull(index)?.trim()?.takeIf(String::isNotEmpty)
        }

        fun parseDecimal(value: String?, field: String): BigDecimal? {
            if (value == null) {
                return null
            }
            val normalized = normalizeDecimal(value, profile.decimalSeparator)
            return normalized.toBigDecimalOrNull()
                ?: throw IllegalArgumentException("Row $rowNumber: $field must be a decimal value.")
        }

        val accountId = when (val rawAccount = valueFor(profile.headerMappings.account)) {
            null -> profile.defaults.accountId?.let(UUID::fromString)
                ?: throw IllegalArgumentException("Row $rowNumber: account is required.")
            else -> accountLookup[rawAccount.lowercase()]
                ?: throw IllegalArgumentException("Row $rowNumber: unknown account '$rawAccount'.")
        }

        val rawType = valueFor(profile.headerMappings.type)
            ?: throw IllegalArgumentException("Row $rowNumber: type is required.")
        val type = try {
            TransactionType.valueOf(rawType.uppercase())
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("Row $rowNumber: unsupported transaction type '$rawType'.")
        }

        val tradeDate = parseDate(
            value = valueFor(profile.headerMappings.tradeDate)
                ?: throw IllegalArgumentException("Row $rowNumber: trade date is required."),
            format = profile.dateFormat,
            rowNumber = rowNumber,
            field = "tradeDate"
        )

        val settlementDate = valueFor(profile.headerMappings.settlementDate)
            ?.let { parseDate(it, profile.dateFormat, rowNumber, "settlementDate") }
            ?: tradeDate

        val rawInstrument = valueFor(profile.headerMappings.instrument)
        val instrumentId = rawInstrument?.let { raw ->
            instrumentLookup[raw.lowercase()]
                ?: throw IllegalArgumentException("Row $rowNumber: unknown instrument '$raw'.")
        }

        val currency = (valueFor(profile.headerMappings.currency) ?: profile.defaults.currency)
            ?.uppercase()
            ?: throw IllegalArgumentException("Row $rowNumber: currency is required.")

        return CreateTransactionCommand(
            accountId = accountId,
            instrumentId = instrumentId,
            type = type,
            tradeDate = tradeDate,
            settlementDate = settlementDate,
            quantity = parseDecimal(valueFor(profile.headerMappings.quantity), "quantity"),
            unitPrice = parseDecimal(valueFor(profile.headerMappings.unitPrice), "unitPrice"),
            grossAmount = parseDecimal(valueFor(profile.headerMappings.grossAmount), "grossAmount")
                ?: throw IllegalArgumentException("Row $rowNumber: grossAmount is required."),
            feeAmount = parseDecimal(valueFor(profile.headerMappings.feeAmount), "feeAmount") ?: BigDecimal.ZERO,
            taxAmount = parseDecimal(valueFor(profile.headerMappings.taxAmount), "taxAmount") ?: BigDecimal.ZERO,
            currency = currency,
            fxRateToPln = parseDecimal(valueFor(profile.headerMappings.fxRateToPln), "fxRateToPln"),
            notes = valueFor(profile.headerMappings.notes).orEmpty()
        )
    }

    private fun buildAccountLookup(accounts: List<Account>): Map<String, UUID> = buildMap {
        accounts.forEach { account ->
            put(account.id.toString().lowercase(), account.id)
            put(account.name.trim().lowercase(), account.id)
        }
    }

    private fun buildInstrumentLookup(instruments: List<Instrument>): Map<String, UUID> = buildMap {
        instruments.forEach { instrument ->
            put(instrument.id.toString().lowercase(), instrument.id)
            put(instrument.name.trim().lowercase(), instrument.id)
            instrument.symbol?.trim()?.lowercase()?.let { put(it, instrument.id) }
        }
    }

    private fun parseDate(
        value: String,
        format: CsvDateFormat,
        rowNumber: Int,
        field: String
    ): LocalDate = try {
        when (format) {
            CsvDateFormat.ISO_LOCAL_DATE -> LocalDate.parse(value)
            CsvDateFormat.DMY_DOTS -> LocalDate.parse(value, DMY_DOTS_FORMAT)
            CsvDateFormat.DMY_SLASH -> LocalDate.parse(value, DMY_SLASH_FORMAT)
            CsvDateFormat.MDY_SLASH -> LocalDate.parse(value, MDY_SLASH_FORMAT)
        }
    } catch (_: DateTimeParseException) {
        throw IllegalArgumentException("Row $rowNumber: $field does not match ${format.name}.")
    }

    private fun normalizeDecimal(value: String, separator: CsvDecimalSeparator): String =
        when (separator) {
            CsvDecimalSeparator.DOT -> value.replace(",", "")
            CsvDecimalSeparator.COMMA -> value.replace(".", "").replace(',', '.')
        }

    private fun delimiterChar(delimiter: CsvDelimiter): Char = when (delimiter) {
        CsvDelimiter.COMMA -> ','
        CsvDelimiter.SEMICOLON -> ';'
        CsvDelimiter.TAB -> '\t'
    }

    private fun parseCsv(text: String, delimiter: Char): List<List<String>> {
        val rows = mutableListOf<List<String>>()
        val currentRow = mutableListOf<String>()
        val currentField = StringBuilder()
        var inQuotes = false
        var index = 0

        while (index < text.length) {
            val char = text[index]
            val next = text.getOrNull(index + 1)

            when {
                char == '"' && inQuotes && next == '"' -> {
                    currentField.append('"')
                    index += 1
                }

                char == '"' -> inQuotes = !inQuotes
                char == delimiter && !inQuotes -> {
                    currentRow += currentField.toString()
                    currentField.setLength(0)
                }

                char == '\n' && !inQuotes -> {
                    currentRow += currentField.toString()
                    rows += currentRow.toList()
                    currentRow.clear()
                    currentField.setLength(0)
                }

                char == '\r' && !inQuotes -> Unit
                else -> currentField.append(char)
            }

            index += 1
        }

        if (currentField.isNotEmpty() || currentRow.isNotEmpty()) {
            currentRow += currentField.toString()
            rows += currentRow.toList()
        }

        return rows
    }

    private companion object {
        val DMY_DOTS_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("dd.MM.uuuu")
        val DMY_SLASH_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/uuuu")
        val MDY_SLASH_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("MM/dd/uuuu")
    }
}

data class PreviewTransactionCsvImportCommand(
    val profileId: UUID,
    val csv: String,
    val skipDuplicates: Boolean? = null
)

data class ImportTransactionCsvCommand(
    val profileId: UUID,
    val csv: String,
    val skipDuplicates: Boolean? = null
)

private data class ParsedCsvImport(
    val profile: TransactionImportProfile,
    val skipDuplicates: Boolean,
    val parsedRows: List<ParsedCsvImportRow>,
    val preview: TransactionImportPreview
)

private data class ParsedCsvImportRow(
    val rowNumber: Int,
    val command: CreateTransactionCommand
)
