-- Create test database for integration tests
-- This runs automatically when the PostgreSQL container starts for the first time

SELECT 'CREATE DATABASE bd_pipeline_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bd_pipeline_test')\gexec
