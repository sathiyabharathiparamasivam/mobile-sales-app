module.exports = {
  userDbConfig: {
    DATABASE_NAME: process.env.DATABASE_NAME || 'UsersDB',
    Users_COLLECTION_Name: process.env.USERS_COLLECTION_NAME || 'Users',
    Transactions_COLLECTION_Name: process.env.TRANSACTIONS_COLLECTION_NAME || 'Transactions',
    CONNECTION_STRING: process.env.CONNECTION_STRING || ''
  },
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
