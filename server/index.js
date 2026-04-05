require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const { userDbConfig, port, corsOrigin } = require('./config');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    passwordHash: { type: String, required: true }
  },
  {
    collection: userDbConfig.Users_COLLECTION_Name
  }
);

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['sale', 'service'], required: true },
    customerName: { type: String, required: true },
    phoneModel: { type: String, required: true },
    brand: { type: String, required: true },
    amount: { type: Number, required: true },
    profit: { type: Number, required: true, default: 0 },
    date: { type: String, required: true },
    notes: { type: String, default: '' }
  },
  {
    timestamps: true,
    collection: userDbConfig.Transactions_COLLECTION_Name
  }
);

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const app = express();

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chozhan Mobiles API',
      version: '1.0.0',
      description: 'API documentation for authentication, sales, and services transactions.'
    },
    servers: [
      {
        url: `http://localhost:${port}`
      }
    ],
    components: {
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'Admin@123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Login successful.' },
            user: {
              type: 'object',
              properties: {
                username: { type: 'string', example: 'admin' },
                fullName: { type: 'string', example: 'Store Administrator' }
              }
            }
          }
        },
        Transaction: {
          type: 'object',
          required: ['type', 'customerName', 'phoneModel', 'brand', 'amount', 'profit', 'date'],
          properties: {
            _id: { type: 'string', example: '6610b90ab213f8f10e123456' },
            type: { type: 'string', enum: ['sale', 'service'], example: 'sale' },
            customerName: { type: 'string', example: 'Arun Kumar' },
            phoneModel: { type: 'string', example: 'Galaxy S24' },
            brand: { type: 'string', example: 'Samsung' },
            amount: { type: 'number', example: 65000 },
            profit: { type: 'number', example: 4500 },
            date: { type: 'string', example: '2026-04-05' },
            notes: { type: 'string', example: 'Customer requested screen guard.' }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Unable to create transaction.' },
            error: { type: 'string', example: 'Validation error details.' }
          }
        }
      }
    }
  },
  apis: [__filename]
});

app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((origin) => origin.trim())
  })
);
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

if (!userDbConfig.CONNECTION_STRING) {
  console.error('MongoDB connection string is missing. Set CONNECTION_STRING before starting the API.');
  process.exit(1);
}

mongoose
  .connect(userDbConfig.CONNECTION_STRING, {
    dbName: userDbConfig.DATABASE_NAME
  })
  .then(async () => {
    console.log('MongoDB connected');
    await seedDefaultUser();
  })
  .catch((error) => {
    console.error('MongoDB connection failed', error);
  });

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Check API health
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 */
app.post('/api/auth/login', async (request, response) => {
  try {
    const { username, password } = request.body;
    const user = await User.findOne({ username: String(username).trim() });

    if (!user || user.passwordHash !== hashPassword(password)) {
      return response.status(401).json({ message: 'Invalid username or password.' });
    }

    return response.json({
      message: 'Login successful.',
      user: {
        username: user.username,
        fullName: user.fullName
      }
    });
  } catch (error) {
    return response.status(500).json({ message: 'Unable to complete login.', error: error.message });
  }
});

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: List transactions
 *     tags:
 *       - Transactions
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [sale, service]
 *         required: false
 *         description: Filter by transaction type
 *     responses:
 *       200:
 *         description: Transactions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Transaction'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.get('/api/transactions', async (request, response) => {
  try {
    const filter = request.query.type ? { type: request.query.type } : {};
    const transactions = await Transaction.find(filter).sort({ createdAt: -1 });
    response.json(transactions);
  } catch (error) {
    response.status(500).json({ message: 'Unable to load transactions.', error: error.message });
  }
});

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a transaction
 *     tags:
 *       - Transactions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Transaction'
 *     responses:
 *       201:
 *         description: Transaction created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Validation or create error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/transactions', async (request, response) => {
  try {
    const transaction = await Transaction.create({
      ...request.body,
      profit: Number(request.body.profit ?? 0)
    });
    response.status(201).json(transaction);
  } catch (error) {
    response.status(400).json({ message: 'Unable to create transaction.', error: error.message });
  }
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   put:
 *     summary: Update a transaction
 *     tags:
 *       - Transactions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Transaction'
 *     responses:
 *       200:
 *         description: Transaction updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       404:
 *         description: Transaction not found
 *       400:
 *         description: Validation or update error
 */
app.put('/api/transactions/:id', async (request, response) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      request.params.id,
      {
        ...request.body,
        profit: Number(request.body.profit ?? 0)
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!transaction) {
      return response.status(404).json({ message: 'Transaction not found.' });
    }

    return response.json(transaction);
  } catch (error) {
    return response.status(400).json({ message: 'Unable to update transaction.', error: error.message });
  }
});

/**
 * @swagger
 * /api/transactions/{id}:
 *   delete:
 *     summary: Delete a transaction
 *     tags:
 *       - Transactions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Transaction deleted
 *       404:
 *         description: Transaction not found
 *       400:
 *         description: Delete error
 */
app.delete('/api/transactions/:id', async (request, response) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(request.params.id);

    if (!transaction) {
      return response.status(404).json({ message: 'Transaction not found.' });
    }

    return response.status(204).send();
  } catch (error) {
    return response.status(400).json({ message: 'Unable to delete transaction.', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

async function seedDefaultUser() {
  const seedUsers = [
    { username: 'admin', fullName: 'Store Administrator', password: 'Admin@123' },
    { username: 'surya', fullName: 'Surya', password: 'surya321' },
    { username: 'kaviya', fullName: 'Kaviya', password: 'kaviya321' }
  ];

  for (const seedUser of seedUsers) {
    const existingUser = await User.findOne({ username: seedUser.username });

    if (!existingUser) {
      await User.create({
        username: seedUser.username,
        fullName: seedUser.fullName,
        passwordHash: hashPassword(seedUser.password)
      });
      console.log(`Seed user created: ${seedUser.username}`);
    }
  }
}
