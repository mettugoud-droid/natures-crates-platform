/**
 * Seed Runner - Executes all seed files in order
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../pool';

const SEED_DIR = join(__dirname);

const seedFiles = [
  '001_data_sources.sql',
  '002_sample_products.sql',
  '003_sample_suppliers.sql',
  '004_sample_competitors.sql',
];

async function runSeeds() {
  console.log('Starting seed execution...\n');
  
  const client = await pool.connect();
  
  try {
    for (const file of seedFiles) {
      const filePath = join(SEED_DIR, file);
      console.log(`Executing: ${file}`);
      
      const sql = readFileSync(filePath, 'utf-8');
      await client.query(sql);
      
      console.log(`  ✓ ${file} completed`);
    }
    
    console.log('\n✅ All seeds executed successfully!');
    
    // Print summary
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM data_sources) as data_sources,
        (SELECT COUNT(*) FROM products) as products,
        (SELECT COUNT(*) FROM suppliers) as suppliers,
        (SELECT COUNT(*) FROM competitors) as competitors
    `);
    
    const row = counts.rows[0];
    console.log('\nDatabase Summary:');
    console.log(`  Data Sources: ${row.data_sources}`);
    console.log(`  Products: ${row.products}`);
    console.log(`  Suppliers: ${row.suppliers}`);
    console.log(`  Competitors: ${row.competitors}`);
    
  } catch (error) {
    console.error('Seed execution failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeeds();
