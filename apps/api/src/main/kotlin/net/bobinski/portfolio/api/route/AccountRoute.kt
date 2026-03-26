package net.bobinski.portfolio.api.route

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AccountType
import net.bobinski.portfolio.api.domain.service.AccountService
import net.bobinski.portfolio.api.domain.service.CreateAccountCommand
import net.bobinski.portfolio.api.domain.service.ReorderAccountsCommand
import org.koin.ktor.ext.inject
import java.util.UUID

fun Route.accountRoute() {
    val accountService: AccountService by inject()

    route("/v1/accounts") {
        get {
            call.respond(accountService.list().map { it.toResponse() })
        }.documented(
            operationId = "listAccounts",
            summary = "List accounts",
            description = "Returns all configured portfolio accounts ordered by their display order.",
            tag = "Accounts"
        )

        post {
            val request = call.receive<CreateAccountRequest>()
            val account = accountService.create(
                CreateAccountCommand(
                    name = request.name,
                    institution = request.institution,
                    type = AccountType.valueOf(request.type),
                    baseCurrency = request.baseCurrency
                )
            )

            call.respond(HttpStatusCode.Created, account.toResponse())
        }.documented(
            operationId = "createAccount",
            summary = "Create an account",
            description = "Creates a new portfolio account with its institution, type and base currency.",
            tag = "Accounts"
        )

        put("/order") {
            val request = call.receive<ReorderAccountsRequest>()
            call.respond(
                accountService.reorder(
                    ReorderAccountsCommand(
                        accountIds = request.accountIds.map { parseUuid(it, "accountIds") }
                    )
                ).map { it.toResponse() }
            )
        }.documented(
            operationId = "reorderAccounts",
            summary = "Reorder accounts",
            description = "Updates the display order for accounts using the supplied ordered list of account IDs.",
            tag = "Accounts"
        )
    }
}

@Serializable
data class CreateAccountRequest(
    val name: String,
    val institution: String,
    val type: String,
    val baseCurrency: String
)

@Serializable
data class ReorderAccountsRequest(
    val accountIds: List<String>
)

@Serializable
data class AccountResponse(
    val id: String,
    val name: String,
    val institution: String,
    val type: String,
    val baseCurrency: String,
    val displayOrder: Int,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

private fun Account.toResponse(): AccountResponse = AccountResponse(
    id = id.toString(),
    name = name,
    institution = institution,
    type = type.name,
    baseCurrency = baseCurrency,
    displayOrder = displayOrder,
    isActive = isActive,
    createdAt = createdAt.toString(),
    updatedAt = updatedAt.toString()
)

private fun parseUuid(value: String, field: String): UUID =
    try {
        UUID.fromString(value)
    } catch (_: IllegalArgumentException) {
        throw IllegalArgumentException("$field must contain valid UUID values.")
    }
