const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

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

app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((origin) => origin.trim())
  })
);
app.use(express.json());

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

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

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

app.get('/api/transactions', async (request, response) => {
  try {
    const filter = request.query.type ? { type: request.query.type } : {};
    const transactions = await Transaction.find(filter).sort({ createdAt: -1 });
    response.json(transactions);
  } catch (error) {
    response.status(500).json({ message: 'Unable to load transactions.', error: error.message });
  }
});

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
