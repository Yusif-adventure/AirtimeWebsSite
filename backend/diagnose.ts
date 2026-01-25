
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("---------------------------------------------------");
console.log("DIAGNOSTIC TOOL");
console.log("URL:", url);
console.log("Key Length:", key ? key.length : "MISSING");
console.log("---------------------------------------------------");

if (!url || !key) {
    console.error("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(url, key);

async function testConnection() {
    console.log("Attempting to connect to 'orders' table...");
    
    // 1. Try to Select
    const { data, error: selectError } = await supabase
        .from('orders')
        .select('count', { count: 'exact', head: true });

    if (selectError) {
        console.error("❌ SELECT FAILED:");
        console.error("Message:", selectError.message);
        console.error("Details:", selectError.details);
        console.error("Hint:", selectError.hint);
        console.error("Code:", selectError.code);
    } else {
        console.log("✅ SELECT SUCCESS! Connection is good.");
    }

    // 2. Try to Insert Fake Data to check Schema
    console.log("\nAttempting dry-run insert...");
    const { error: insertError } = await supabase
        .from('orders')
        .insert({
            id: 'test_connection_' + Date.now(),
            network: 'TEST',
            bundle_data: 'TEST',
            amount: 0,
            recipient_number: '0000000000',
            payment_number: '0000000000'
        })
        .select(); // Try to return the data

    if (insertError) {
        console.error("❌ INSERT FAILED:");
        console.error("Message:", insertError.message);
        console.error("Details:", insertError.details);
        console.error("Code:", insertError.code);
    } else {
        console.log("✅ INSERT SUCCESS! Table schema is correct.");
        // Cleanup
        // await supabase.from('orders').delete().eq('network', 'TEST');
    }
}

testConnection();
