CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(16) DEFAULT 'party' NOT NULL,
	"role" varchar(16),
	"opening_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"account_title" varchar(200),
	"owner" varchar(200),
	"cnic" varchar(30),
	"address" varchar(300),
	"phone" varchar(50),
	"whatsapp" varchar(50),
	"email" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"date" date NOT NULL,
	"product" varchar(200),
	"packing" varchar(100),
	"unit" varchar(50),
	"qty" numeric(12, 3),
	"rate" numeric(14, 2),
	"debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"account" varchar(300),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"account_title" varchar(200),
	"owner" varchar(200),
	"cnic" varchar(30),
	"address" varchar(300),
	"phone" varchar(50),
	"whatsapp" varchar(50),
	"email" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"detail" varchar(400) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"transaction_id" integer,
	"date" date NOT NULL,
	"debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchasing" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"detail" varchar(400) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"employee" varchar(200) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"account" varchar(300),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"detail" varchar(400) NOT NULL,
	"qty" numeric(12, 3),
	"rate" numeric(14, 2),
	"amount" numeric(14, 2) NOT NULL,
	"product" varchar(200),
	"packing" varchar(100),
	"unit" varchar(50),
	"customer_id" integer,
	"ledger_entry_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"kind" varchar(24) NOT NULL,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"party_account_id" integer,
	"partner_account_id" integer,
	"counter_account_id" integer,
	"product" varchar(200),
	"packing" varchar(100),
	"unit" varchar(50),
	"qty" numeric(12, 3),
	"rate" numeric(14, 2),
	"sale_kg" numeric(12, 3),
	"employee" varchar(200),
	"detail" varchar(400),
	"note" varchar(300),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) DEFAULT 'Admin' NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(32) DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "customer_entries" ADD CONSTRAINT "customer_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_ledger_entry_id_customer_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "public"."customer_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_party_account_id_accounts_id_fk" FOREIGN KEY ("party_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_partner_account_id_accounts_id_fk" FOREIGN KEY ("partner_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counter_account_id_accounts_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_type_idx" ON "accounts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "customer_entries_customer_date_idx" ON "customer_entries" USING btree ("customer_id","date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ledger_entries_account_date_idx" ON "ledger_entries" USING btree ("account_id","date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "purchasing_date_idx" ON "purchasing" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "salary_date_idx" ON "salary" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sales_date_idx" ON "sales" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sales_customer_idx" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transactions_kind_idx" ON "transactions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "transactions_party_idx" ON "transactions" USING btree ("party_account_id");--> statement-breakpoint
CREATE INDEX "transactions_partner_idx" ON "transactions" USING btree ("partner_account_id");