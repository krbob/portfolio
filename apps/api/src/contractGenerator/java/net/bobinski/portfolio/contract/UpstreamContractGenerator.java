package net.bobinski.portfolio.contract;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.parser.OpenAPIV3Parser;
import io.swagger.v3.parser.core.models.ParseOptions;
import io.swagger.v3.parser.core.models.SwaggerParseResult;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class UpstreamContractGenerator {
    private static final String PACKAGE_NAME =
        "net.bobinski.portfolio.api.marketdata.contract.generated";

    private UpstreamContractGenerator() {
    }

    public static void main(String[] arguments) throws IOException {
        if (arguments.length != 3) {
            throw new IllegalArgumentException(
                "Expected stock-analyst snapshot, edo-calculator snapshot, and output file."
            );
        }

        var stockAnalyst = contract(
            "StockAnalyst",
            Path.of(arguments[0]),
            projections(
                projection("Quote", "symbol", "currency", "date", "lastPrice", "previousClose", "provenance"),
                projection("StockHistory", "prices", "provenance"),
                projection("HistoricalPrice", "date", "close"),
                projection(
                    "DataProvenance",
                    "source",
                    "retrievedAt",
                    "marketTimestamp",
                    "marketDate",
                    "currency",
                    "unitScale",
                    "adjustment",
                    "coverageFrom",
                    "coverageTo",
                    "status",
                    "priceStatus",
                    "analyticsStatus",
                    "analyticsLimitations"
                ),
                projection("ApiError", "error", "errorCode", "retryable", "requestId")
            ),
            operations(
                operation("QUOTE", "getQuote"),
                operation("HISTORY", "getStockHistory")
            )
        );
        var edoCalculator = contract(
            "EdoCalculator",
            Path.of(arguments[1]),
            projections(
                projection("EdoResponse", "asOf", "edoValue"),
                projection("EdoValue", "totalValue", "periods"),
                projection("EdoPeriodBreakdown", "daysInPeriod", "daysElapsed", "ratePercent"),
                projection("EdoHistoryResponse", "points"),
                projection("EdoHistoryPointResponse", "date", "totalValue"),
                projection("InflationResponse", "from", "until", "multiplier"),
                projection("MonthlyInflationSeriesResponse", "from", "until", "points"),
                projection("MonthlyInflationPointResponse", "month", "multiplier"),
                projection("ApiErrorResponse", "error", "errorCode", "retryable", "requestId")
            ),
            operations(
                operation("CURRENT_VALUE", "getCurrentEdoValue"),
                operation("VALUE_AT_DATE", "getEdoValueAtDate"),
                operation("HISTORY", "getEdoValueHistory"),
                operation("INFLATION_SINCE", "getCumulativeInflationSince"),
                operation("MONTHLY_INFLATION", "getMonthlyInflation")
            )
        );

        var output = new StringBuilder()
            .append("// Generated from vendored OpenAPI snapshots. Do not edit.\n")
            .append("package ").append(PACKAGE_NAME).append("\n\n")
            .append("import kotlinx.serialization.Serializable\n\n");
        emitContract(output, stockAnalyst);
        emitContract(output, edoCalculator);

        var outputPath = Path.of(arguments[2]);
        Files.createDirectories(outputPath.getParent());
        Files.writeString(outputPath, output.toString(), StandardCharsets.UTF_8);
    }

    private static Contract contract(
        String prefix,
        Path snapshot,
        LinkedHashMap<String, List<String>> projections,
        LinkedHashMap<String, String> operations
    ) {
        var options = new ParseOptions();
        options.setResolve(false);
        options.setResolveFully(false);
        SwaggerParseResult result = new OpenAPIV3Parser().readLocation(snapshot.toString(), null, options);
        if (result.getOpenAPI() == null || !result.getMessages().isEmpty()) {
            throw new IllegalArgumentException(
                "Cannot parse " + snapshot + ": " + String.join("; ", result.getMessages())
            );
        }
        return new Contract(prefix, result.getOpenAPI(), projections, operations);
    }

    private static void emitContract(StringBuilder output, Contract contract) {
        output.append("internal object ").append(contract.prefix()).append("ContractPaths {\n");
        contract.operations().forEach((constant, operationId) -> output
            .append("    const val ").append(constant).append(" = \"")
            .append(pathForOperation(contract.openApi(), operationId)).append("\"\n"));
        output.append("}\n\n");

        contract.projections().forEach((schemaName, fields) -> {
            Schema<?> schema = schema(contract.openApi(), schemaName);
            Map<String, Schema<?>> properties = properties(schema, schemaName);
            Set<String> required = schema.getRequired() == null ? Set.of() : Set.copyOf(schema.getRequired());

            output.append("@Serializable\ninternal data class ")
                .append(generatedClassName(contract.prefix(), schemaName)).append("(\n");
            for (int index = 0; index < fields.size(); index++) {
                String field = fields.get(index);
                Schema<?> fieldSchema = properties.get(field);
                if (fieldSchema == null) {
                    throw new IllegalArgumentException(
                        "Schema " + schemaName + " does not declare projected field " + field
                    );
                }
                boolean optional = !required.contains(field);
                boolean nullable = isNullable(fieldSchema, contract.openApi());
                String type = kotlinType(fieldSchema, contract);
                output.append("    val ").append(field).append(": ").append(type);
                if (optional || nullable) {
                    output.append('?');
                }
                if (optional) {
                    output.append(" = null");
                }
                output.append(index == fields.size() - 1 ? "\n" : ",\n");
            }
            output.append(")\n\n");
        });
    }

    private static String pathForOperation(OpenAPI openApi, String expectedOperationId) {
        for (var pathEntry : openApi.getPaths().entrySet()) {
            for (Operation operation : pathEntry.getValue().readOperations()) {
                if (expectedOperationId.equals(operation.getOperationId())) {
                    if (!pathEntry.getKey().startsWith("/v1/")) {
                        throw new IllegalArgumentException(
                            "Operation " + expectedOperationId + " is not versioned: " + pathEntry.getKey()
                        );
                    }
                    return pathEntry.getKey();
                }
            }
        }
        throw new IllegalArgumentException("Missing operationId " + expectedOperationId);
    }

    private static Schema<?> schema(OpenAPI openApi, String name) {
        Schema<?> schema = openApi.getComponents().getSchemas().get(name);
        if (schema == null) {
            throw new IllegalArgumentException("Missing schema " + name);
        }
        return schema;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Schema<?>> properties(Schema<?> schema, String name) {
        if (schema.getProperties() == null) {
            throw new IllegalArgumentException("Schema " + name + " has no properties");
        }
        return (Map<String, Schema<?>>) (Map<?, ?>) schema.getProperties();
    }

    private static String kotlinType(Schema<?> candidate, Contract contract) {
        Schema<?> schema = nonNullVariant(candidate);
        if (schema.get$ref() != null) {
            String referencedName = schema.get$ref().substring(schema.get$ref().lastIndexOf('/') + 1);
            if (contract.projections().containsKey(referencedName)) {
                return generatedClassName(contract.prefix(), referencedName);
            }
            return kotlinType(schema(contract.openApi(), referencedName), contract);
        }

        String type = schema.getType();
        if (type == null && schema.getTypes() != null) {
            type = schema.getTypes().stream().filter(value -> !"null".equals(value)).findFirst().orElse(null);
        }
        if ("array".equals(type)) {
            return "List<" + kotlinType(schema.getItems(), contract) + ">";
        }
        if ("string".equals(type)) {
            return "String";
        }
        if ("boolean".equals(type)) {
            return "Boolean";
        }
        if ("integer".equals(type)) {
            return "int64".equals(schema.getFormat()) ? "Long" : "Int";
        }
        if ("number".equals(type)) {
            return "Double";
        }
        throw new IllegalArgumentException("Unsupported projected schema type: " + type);
    }

    private static boolean isNullable(Schema<?> candidate, OpenAPI openApi) {
        if (Boolean.TRUE.equals(candidate.getNullable())) {
            return true;
        }
        if (candidate.getTypes() != null && candidate.getTypes().contains("null")) {
            return true;
        }
        if (candidate.getOneOf() != null && candidate.getOneOf().stream().anyMatch(UpstreamContractGenerator::isNullSchema)) {
            return true;
        }
        if (candidate.get$ref() != null) {
            String name = candidate.get$ref().substring(candidate.get$ref().lastIndexOf('/') + 1);
            Schema<?> referenced = schema(openApi, name);
            return Boolean.TRUE.equals(referenced.getNullable()) ||
                referenced.getTypes() != null && referenced.getTypes().contains("null");
        }
        return false;
    }

    private static Schema<?> nonNullVariant(Schema<?> schema) {
        if (schema.getOneOf() == null) {
            return schema;
        }
        return schema.getOneOf().stream()
            .filter(candidate -> !isNullSchema(candidate))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("oneOf has no non-null variant"));
    }

    private static boolean isNullSchema(Schema<?> schema) {
        return "null".equals(schema.getType()) || schema.getTypes() != null && schema.getTypes().contains("null");
    }

    private static String generatedClassName(String prefix, String schemaName) {
        return prefix + schemaName + "Payload";
    }

    @SafeVarargs
    private static LinkedHashMap<String, List<String>> projections(Map.Entry<String, List<String>>... entries) {
        var result = new LinkedHashMap<String, List<String>>();
        for (var entry : entries) {
            result.put(entry.getKey(), entry.getValue());
        }
        return result;
    }

    private static Map.Entry<String, List<String>> projection(String schema, String... fields) {
        return Map.entry(schema, List.of(fields));
    }

    @SafeVarargs
    private static LinkedHashMap<String, String> operations(Map.Entry<String, String>... entries) {
        var result = new LinkedHashMap<String, String>();
        for (var entry : entries) {
            result.put(entry.getKey(), entry.getValue());
        }
        return result;
    }

    private static Map.Entry<String, String> operation(String constant, String operationId) {
        return Map.entry(constant, operationId);
    }

    private record Contract(
        String prefix,
        OpenAPI openApi,
        LinkedHashMap<String, List<String>> projections,
        LinkedHashMap<String, String> operations
    ) {
    }
}
