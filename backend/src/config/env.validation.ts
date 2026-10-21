import * as Joi from 'joi';

/** Fail fast at boot if the .env is incomplete. */
export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('8h'),

  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(1433),
  DB_NAME: Joi.string().default('NexusDemo'),
  DB_TRUST_SERVER_CERT: Joi.boolean().default(true),
  DB_APP_USER: Joi.string().required(),
  DB_APP_PASSWORD: Joi.string().required(),
  DB_AGENT_USER: Joi.string().required(),
  DB_AGENT_PASSWORD: Joi.string().required(),
  DB_ADMIN_USER: Joi.string().required(),
  DB_ADMIN_PASSWORD: Joi.string().required(),

  LLM_BASE_URL: Joi.string().uri().default('http://127.0.0.1:8080/v1'),
  LLM_MODEL: Joi.string().default('qwen2.5-3b'),
  LLM_TIMEOUT_MS: Joi.number().default(120000),

  AGENT_MAX_ROWS: Joi.number().default(100),
  AGENT_QUERY_TIMEOUT_MS: Joi.number().default(5000),
  AGENT_MAX_STEPS: Joi.number().default(5),
});
