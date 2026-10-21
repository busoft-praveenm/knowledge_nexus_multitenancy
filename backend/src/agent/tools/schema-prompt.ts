/** Compact schema description handed to the model in the system prompt. */
export const SCHEMA_PROMPT = `
Tables (Microsoft SQL Server, schema "app"):
- app.customers(customer_id INT, tenant_id INT, name, email, phone, city, tier ['Standard','Silver','Gold','Platinum'], created_at)
- app.tickets(ticket_id INT, tenant_id INT, customer_id INT -> app.customers, subject, body, status ['Open','In Progress','Resolved','Closed'], priority ['Low','Medium','High','Urgent'], created_at)
- app.invoices(invoice_id INT, tenant_id INT, customer_id INT -> app.customers, invoice_no, amount DECIMAL, currency, status ['Paid','Unpaid','Overdue'], issued_on DATE, due_on DATE)
- app.tenants(tenant_id INT, name, slug, industry, plan)
Rules: T-SQL syntax only (use TOP n, not LIMIT). One SELECT statement per call.`.trim();
