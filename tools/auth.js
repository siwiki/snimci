import 'dotenv/config';
import {ConfidentialClientApplication, LogLevel} from '@azure/msal-node';
import express from 'express';
import open from 'open';

const {AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, CALLBACK_URL} = process.env;
const SCOPES = ['Files.Read.All', 'Files.ReadWrite.All'];

const pca = new ConfidentialClientApplication({
    auth: {
        authority: `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}`,
        clientId: AZURE_AD_CLIENT_ID,
        clientSecret: AZURE_AD_CLIENT_SECRET
    },
    system: {
        loggerOptions: {
            loggerCallback: (_, message) => console.error(message),
            piiLoggingEnabled: false,
            logLevel: LogLevel.Error
        }
    }
});

export async function authenticate() {
    const authUrl = await pca.getAuthCodeUrl({
        scopes: SCOPES,
        redirectUri: CALLBACK_URL
    });
    await open(authUrl);
    return new Promise(function(resolve) {
        const app = express();
        let server = null;
        app.get('*', async function(request, response) {
            if (request.query.code) {
                const result = await pca.acquireTokenByCode({
                    code: request.query.code,
                    redirectUri: CALLBACK_URL,
                    scopes: SCOPES
                });
                resolve(result.accessToken);
                response.send('You can now close this page.');
                if (server) {
                    server.close();
                }
            } else {
                response.send('How are you here?');
            }
        });
        server = app.listen(3000);
    });
}
