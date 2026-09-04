import { Pool } from "pg";
import fs from "fs";
import path from "path";

/**
 * Database Migration Runner
 * Executes all SQL migration files in sequence
 */

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "land_registry",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log("🔄 Starting database migrations...");

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get migration files
    const migrationsDir = path.join(__dirname, "../../../migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      // Check if migration already executed
      const result = await client.query(
        "SELECT * FROM migrations WHERE name = $1",
        [file]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Migration already executed: ${file}`);
        continue;
      }

      try {
        const migrationPath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(migrationPath, "utf-8");

        console.log(`🚀 Executing migration: ${file}`);
        await client.query(sqlContent);

        // Record migration
        await client.query("INSERT INTO migrations (name) VALUES ($1)", [file]);

        console.log(`✅ Completed migration: ${file}`);
      } catch (error: any) {
        console.error(`❌ Error executing migration ${file}:`, error.message);
        throw error;
      }
    }

    console.log("🎉 All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

// Run migrations
runMigrations().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
