require('dotenv').config();
const app = require('./app');
const { verifyEmailConnection } = require('./services/emailService');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  verifyEmailConnection();
});

