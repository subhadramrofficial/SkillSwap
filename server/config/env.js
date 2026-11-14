/**
 * Environment variable validation module
 * Validates that all required environment configurations are present at startup.
 */

const requiredEnvVars = ['PORT', 'MONGODB_URI', 'JWT_SECRET'];

function validateEnv() {
  const missing = [];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[Startup Error] Missing required environment variables: ${missing.join(', ')}. Please check your .env file.`
    );
  }
}

module.exports = { validateEnv };
