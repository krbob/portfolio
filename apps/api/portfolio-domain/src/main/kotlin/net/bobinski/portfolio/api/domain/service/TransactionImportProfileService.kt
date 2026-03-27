package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.util.UUID
import net.bobinski.portfolio.api.domain.error.ResourceNotFoundException
import net.bobinski.portfolio.api.domain.model.AuditEventCategory
import net.bobinski.portfolio.api.domain.model.CsvDateFormat
import net.bobinski.portfolio.api.domain.model.CsvDecimalSeparator
import net.bobinski.portfolio.api.domain.model.CsvDelimiter
import net.bobinski.portfolio.api.domain.model.TransactionImportDefaults
import net.bobinski.portfolio.api.domain.model.TransactionImportHeaderMappings
import net.bobinski.portfolio.api.domain.model.TransactionImportProfile
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.TransactionImportProfileRepository

class TransactionImportProfileService(
    private val repository: TransactionImportProfileRepository,
    private val accountRepository: AccountRepository,
    private val auditLogService: AuditLogService,
    private val clock: Clock
) {
    suspend fun list(): List<TransactionImportProfile> = repository.list()

    suspend fun create(command: SaveTransactionImportProfileCommand): TransactionImportProfile {
        validateUniqueName(name = command.name)
        validateDefaults(command.defaults)
        val timestamp = Instant.now(clock)
        val profile = repository.save(
            TransactionImportProfile(
                id = UUID.randomUUID(),
                name = command.name.trim(),
                description = command.description.trim(),
                delimiter = command.delimiter,
                dateFormat = command.dateFormat,
                decimalSeparator = command.decimalSeparator,
                skipDuplicatesByDefault = command.skipDuplicatesByDefault,
                headerMappings = command.headerMappings,
                defaults = command.defaults,
                createdAt = timestamp,
                updatedAt = timestamp
            )
        )
        recordAudit("TRANSACTION_IMPORT_PROFILE_CREATED", profile, "Created transaction import profile.")
        return profile
    }

    suspend fun update(id: UUID, command: SaveTransactionImportProfileCommand): TransactionImportProfile {
        val existing = repository.get(id)
            ?: throw ResourceNotFoundException("Transaction import profile $id was not found.")
        validateUniqueName(name = command.name, excludedId = id)
        validateDefaults(command.defaults)
        val profile = repository.save(
            existing.copy(
                name = command.name.trim(),
                description = command.description.trim(),
                delimiter = command.delimiter,
                dateFormat = command.dateFormat,
                decimalSeparator = command.decimalSeparator,
                skipDuplicatesByDefault = command.skipDuplicatesByDefault,
                headerMappings = command.headerMappings,
                defaults = command.defaults,
                updatedAt = Instant.now(clock)
            )
        )
        recordAudit("TRANSACTION_IMPORT_PROFILE_UPDATED", profile, "Updated transaction import profile.")
        return profile
    }

    suspend fun delete(id: UUID) {
        if (!repository.delete(id)) {
            throw ResourceNotFoundException("Transaction import profile $id was not found.")
        }
        auditLogService.record(
            category = AuditEventCategory.IMPORTS,
            action = "TRANSACTION_IMPORT_PROFILE_DELETED",
            entityType = "TRANSACTION_IMPORT_PROFILE",
            entityId = id.toString(),
            message = "Deleted transaction import profile $id."
        )
    }

    private suspend fun validateDefaults(defaults: TransactionImportDefaults) {
        val accountId = defaults.accountId ?: return
        val parsedAccountId = try {
            UUID.fromString(accountId)
        } catch (_: IllegalArgumentException) {
            throw IllegalArgumentException("Import profile default account id must be a valid UUID.")
        }
        accountRepository.get(parsedAccountId)
            ?: throw ResourceNotFoundException("Account $parsedAccountId was not found.")
    }

    private suspend fun validateUniqueName(name: String, excludedId: UUID? = null) {
        val normalizedName = name.trim()
        require(normalizedName.isNotBlank()) {
            "Import profile name is required."
        }
        require(
            repository.list().none { profile ->
                profile.name == normalizedName && profile.id != excludedId
            }
        ) {
            "Import profile name '$normalizedName' is already in use."
        }
    }

    private suspend fun recordAudit(
        action: String,
        profile: TransactionImportProfile,
        message: String
    ) {
        auditLogService.record(
            category = AuditEventCategory.IMPORTS,
            action = action,
            entityType = "TRANSACTION_IMPORT_PROFILE",
            entityId = profile.id.toString(),
            message = message,
            metadata = mapOf(
                "name" to profile.name,
                "delimiter" to profile.delimiter.name,
                "dateFormat" to profile.dateFormat.name,
                "decimalSeparator" to profile.decimalSeparator.name
            )
        )
    }
}

data class SaveTransactionImportProfileCommand(
    val name: String,
    val description: String,
    val delimiter: CsvDelimiter,
    val dateFormat: CsvDateFormat,
    val decimalSeparator: CsvDecimalSeparator,
    val skipDuplicatesByDefault: Boolean,
    val headerMappings: TransactionImportHeaderMappings,
    val defaults: TransactionImportDefaults
)
