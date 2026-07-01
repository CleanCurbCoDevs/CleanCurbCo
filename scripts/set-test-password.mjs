import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const USER_EMAIL = "jdoms@stonebranchcapital.com";
const NEW_PASSWORD = "94y67reROCKS!";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();

if (listError) {
  throw listError;
}

const user = usersData.users.find(
  (u) => u.email?.toLowerCase() === USER_EMAIL.toLowerCase()
);

if (!user) {
  throw new Error(`No user found for ${USER_EMAIL}`);
}

const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
  password: NEW_PASSWORD,
  email_confirm: true,
});

if (error) {
  throw error;
}

console.log(`Password updated for ${data.user.email}`);