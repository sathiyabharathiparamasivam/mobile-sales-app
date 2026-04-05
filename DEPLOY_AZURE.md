# Deploy To Azure

This project is split into two Azure deployments:

1. Frontend: Angular app on Azure Static Web Apps
2. Backend: Node.js API on Azure App Service

## Architecture

- Frontend URL example: `https://chozhan-mobiles.azurestaticapps.net`
- API URL example: `https://chozhan-mobiles-api.azurewebsites.net`
- Database: MongoDB Atlas

## 1. Deploy The API To Azure App Service

Create a Linux Web App for Node.js 22 and configure these application settings in Azure App Service:

- `CONNECTION_STRING`
- `DATABASE_NAME=UsersDB`
- `USERS_COLLECTION_NAME=Users`
- `TRANSACTIONS_COLLECTION_NAME=Transactions`
- `CORS_ORIGIN=https://YOUR_STATIC_WEB_APP_URL`

Recommended startup command:

```text
node server/index.js
```

If you deploy from a ZIP package or GitHub repository, App Service can install Node dependencies during deployment.

## 2. Deploy The Angular Frontend To Azure Static Web Apps

Before creating the frontend deployment, update [environment.prod.ts](/C:/Users/sathi/OneDrive/Desktop/MobileSalesApp/mobile-sales-app/src/environments/environment.prod.ts) with your real API URL:

```ts
export const environment = {
  production: true,
  apiBaseUrl: 'https://YOUR_API_APP_NAME.azurewebsites.net/api'
};
```

Use these build settings in Azure Static Web Apps:

- App location: `/`
- Output location: `dist/mobile-sales-app/browser`
- Build command: `npm run build`

The SPA routing fallback is already configured in [staticwebapp.config.json](/C:/Users/sathi/OneDrive/Desktop/MobileSalesApp/mobile-sales-app/public/staticwebapp.config.json).

## 3. Deployment Order

1. Deploy the API first.
2. Copy the real API URL into `src/environments/environment.prod.ts`.
3. Deploy the frontend.
4. Set the API `CORS_ORIGIN` to the frontend URL.

## 4. Azure CLI Example

### API App Service

```bash
az group create --name rg-chozhan-mobiles --location centralindia
az appservice plan create --name asp-chozhan-mobiles --resource-group rg-chozhan-mobiles --is-linux --sku B1
az webapp create --name chozhan-mobiles-api --resource-group rg-chozhan-mobiles --plan asp-chozhan-mobiles --runtime "NODE|22-lts"
az webapp config appsettings set --name chozhan-mobiles-api --resource-group rg-chozhan-mobiles --settings CONNECTION_STRING="<your-mongodb-connection-string>" DATABASE_NAME="UsersDB" USERS_COLLECTION_NAME="Users" TRANSACTIONS_COLLECTION_NAME="Transactions" CORS_ORIGIN="https://YOUR_STATIC_WEB_APP_URL"
```

### Frontend Static Web App

Create the Static Web App in the Azure portal or with Azure CLI, then connect the repo and use:

- Build preset: Angular
- App location: `/`
- Output location: `dist/mobile-sales-app/browser`

## 5. Important Notes

- Do not keep the MongoDB connection string hardcoded in source control.
- Restart the API after changing App Service settings.
- The API seeds the default users on startup if they do not already exist.

## 6. GitHub Actions

Two workflows are included:

- Frontend: [.github/workflows/deploy-frontend-static-web-app.yml](/C:/Users/sathi/OneDrive/Desktop/MobileSalesApp/mobile-sales-app/.github/workflows/deploy-frontend-static-web-app.yml)
- API: [.github/workflows/deploy-api-app-service.yml](/C:/Users/sathi/OneDrive/Desktop/MobileSalesApp/mobile-sales-app/.github/workflows/deploy-api-app-service.yml)

### Required GitHub Secrets

#### Frontend

- `AZURE_STATIC_WEB_APPS_API_TOKEN`

#### API

- `AZUREAPPSERVICE_PUBLISHPROFILE`

### One Required Edit

Update the API workflow with your real App Service name in:

- [deploy-api-app-service.yml](/C:/Users/sathi/OneDrive/Desktop/MobileSalesApp/mobile-sales-app/.github/workflows/deploy-api-app-service.yml)

Replace:

```yaml
app-name: YOUR_API_APP_SERVICE_NAME
```

with your actual Azure App Service name.
