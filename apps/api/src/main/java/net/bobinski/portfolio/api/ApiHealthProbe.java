package net.bobinski.portfolio.api;

import java.net.HttpURLConnection;
import java.net.URI;

/** Container health probe that depends only on the Java runtime shipped with the API. */
public final class ApiHealthProbe {
    private static final URI DEFAULT_ENDPOINT = URI.create("http://127.0.0.1:18082/v1/health");
    private static final int TIMEOUT_MILLIS = 1_000;

    private ApiHealthProbe() {
    }

    public static void main(String[] args) {
        URI endpoint;
        try {
            endpoint = args.length == 0 ? DEFAULT_ENDPOINT : URI.create(args[0]);
        } catch (IllegalArgumentException exception) {
            System.err.println("Invalid health endpoint: " + exception.getMessage());
            System.exit(2);
            return;
        }

        if (!isHealthy(endpoint, TIMEOUT_MILLIS)) {
            System.err.println("API health probe failed for " + endpoint);
            System.exit(1);
        }
    }

    static boolean isHealthy(URI endpoint, int timeoutMillis) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) endpoint.toURL().openConnection();
            connection.setConnectTimeout(timeoutMillis);
            connection.setReadTimeout(timeoutMillis);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestMethod("GET");
            connection.setUseCaches(false);
            return connection.getResponseCode() == HttpURLConnection.HTTP_OK;
        } catch (Exception exception) {
            return false;
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }
}
