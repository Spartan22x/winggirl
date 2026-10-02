# Supabase setup

## 1. Create the project

1. Open the Supabase dashboard and choose **New project**.
2. Select an organization, enter a project name, choose a strong database password, and select a region.
3. Wait for the project to finish provisioning.

## 2. Apply the database migrations

1. Apply the SQL files in `supabase/migrations/` in timestamp order, once each.
2. For a new project, run `202609250001_winggirl_schema.sql` first, then the later migration files.
3. The `202610020001_plan_participation_and_cancellation.sql` migration adds the cancelled status and tightens plan-member policies. It must be applied before using host cancellation or the updated membership actions.
4. In CLI-managed environments, link the project and run `supabase db push` instead. Do not run a migration twice against the same database.

For SQL Editor setup, open **SQL Editor**, create a query for each file, paste its contents, and select **Run** in timestamp order.

## 3. Configure authentication

1. Open **Authentication > Providers**.
2. Turn on **Email**. Choose whether email confirmation is required for the environment.
3. When credentials are available, turn on **Google**, **Apple**, and **Facebook**, then enter each provider's client ID, secret, and callback details shown by Supabase.
4. In **Authentication > URL Configuration**, add the app redirect URL `winggirl://auth/callback`.
5. For Expo Web development, also add the local web redirect URL shown by the running Expo app, such as `http://localhost:8082`.

The app exposes all four provider paths, but social sign-in remains unavailable until its provider is enabled here.

## 4. Configure the client

1. Open **Project Settings > API**.
2. Copy the **Project URL** and the public **Publishable key** (or legacy `anon` key).
3. Copy `.env.example` to `.env`.
4. Set `EXPO_PUBLIC_SUPABASE_URL` to the Project URL and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the public key.
5. Restart Expo after changing environment variables.

Never copy the `service_role` key into `.env` or any Expo client bundle. The migration and app are designed to operate with the public client key and RLS only.

## 5. Run security checks

The structure smoke tests are in `supabase/tests/rls.sql`. Run them through a Supabase pgTAP-enabled test workflow after the migration is applied. The application itself cannot prove RLS behavior without a configured Supabase project and at least two test users.