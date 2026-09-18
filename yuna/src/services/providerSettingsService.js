import apiClient from "./apiClient";

const PROVIDERS_PATH = "/settings/providers";

/**
 * ==========================================
 * providerSettingsService
 * ------------------------------------------
 * Talks to the per-user AI provider credential API. Every response here
 * comes straight from providerCredentialService's status shape on the
 * server (hasKey/maskedKey/enabled/models) - never a decrypted or
 * plaintext key, by construction of the backend routes themselves, not
 * just convention on this side.
 * ==========================================
 */
class ProviderSettingsService {

    async listProviders() {

        const { data } = await apiClient.get(
            PROVIDERS_PATH
        );

        return data.providers;

    }

    async setApiKey(provider, apiKey) {

        const { data } = await apiClient.put(
            `${PROVIDERS_PATH}/${provider}/key`,
            { apiKey }
        );

        return data.provider;

    }

    async removeApiKey(provider) {

        const { data } = await apiClient.delete(
            `${PROVIDERS_PATH}/${provider}/key`
        );

        return data.provider;

    }

    async setModels(provider, models) {

        const { data } = await apiClient.put(
            `${PROVIDERS_PATH}/${provider}/models`,
            { models }
        );

        return data.provider;

    }

    async setEnabled(provider, enabled) {

        const { data } = await apiClient.put(
            `${PROVIDERS_PATH}/${provider}/enabled`,
            { enabled }
        );

        return data.provider;

    }

}

export default new ProviderSettingsService();
