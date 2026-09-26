// A small subset of the supabase-js query builder, executed as SQL on PGlite
// (as the service role). Covers exactly the calls AiUsageService makes, so the
// real service code runs against the real schema and functions.

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function columnExpr(column) {
  const jsonMatch = /^(\w+)->>(\w+)$/.exec(column);
  return jsonMatch ? `${quoteIdent(jsonMatch[1])}->>'${jsonMatch[2]}'` : quoteIdent(column);
}

class QueryBuilder {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.params = [];
    this.orders = [];
    this.limitCount = null;
    this.operation = 'select';
    this.columns = '*';
    this.countMode = null;
    this.headOnly = false;
    this.single = false;
  }

  param(value) {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  select(columns = '*', options = {}) {
    if (this.operation === 'select') {
      this.columns = columns;
      this.countMode = options.count || null;
      this.headOnly = Boolean(options.head);
    }
    return this;
  }

  eq(column, value) {
    this.filters.push(`${columnExpr(column)} = ${this.param(value)}`);
    return this;
  }

  in(column, values) {
    this.filters.push(`${columnExpr(column)} = any(${this.param(values)})`);
    return this;
  }

  gte(column, value) {
    this.filters.push(`${columnExpr(column)} >= ${this.param(value)}`);
    return this;
  }

  not(column, operator, value) {
    if (operator === 'is' && value === null) {
      this.filters.push(`${columnExpr(column)} is not null`);
    }
    return this;
  }

  order(column, { ascending = true, nullsFirst } = {}) {
    const nulls = nullsFirst === undefined ? '' : nullsFirst ? ' nulls first' : ' nulls last';
    this.orders.push(`${quoteIdent(column)} ${ascending ? 'asc' : 'desc'}${nulls}`);
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  insert(row) {
    this.operation = 'insert';
    this.row = row;
    return this;
  }

  update(row) {
    this.operation = 'update';
    this.row = row;
    return this;
  }

  upsert(row, { onConflict }) {
    this.operation = 'upsert';
    this.row = row;
    this.conflict = onConflict;
    return this;
  }

  where() {
    return this.filters.length ? ` where ${this.filters.join(' and ')}` : '';
  }

  toSql() {
    const table = `public.${quoteIdent(this.table)}`;
    if (this.operation === 'insert' || this.operation === 'upsert') {
      const keys = Object.keys(this.row);
      const values = keys.map((key) => this.param(serialize(this.row[key])));
      let sql = `insert into ${table} (${keys.map(quoteIdent).join(', ')}) values (${values.join(', ')})`;
      if (this.operation === 'upsert') {
        sql += ` on conflict (${quoteIdent(this.conflict)}) do update set ${keys.map((key) => `${quoteIdent(key)} = excluded.${quoteIdent(key)}`).join(', ')}`;
      }
      return sql;
    }
    if (this.operation === 'update') {
      const sets = Object.keys(this.row).map((key) => `${quoteIdent(key)} = ${this.param(serialize(this.row[key]))}`);
      return `update ${table} set ${sets.join(', ')}${this.where()}`;
    }
    if (this.headOnly) {
      return `select count(*)::int as count from ${table}${this.where()}`;
    }
    const cols = this.columns === '*' ? '*' : this.columns.split(',').map((c) => quoteIdent(c.trim())).join(', ');
    let sql = `select ${cols} from ${table}${this.where()}`;
    if (this.orders.length) sql += ` order by ${this.orders.join(', ')}`;
    if (this.limitCount) sql += ` limit ${Number(this.limitCount)}`;
    return sql;
  }

  async execute() {
    try {
      const result = await this.db.query(this.toSql(), this.params);
      if (this.headOnly) {
        return { count: result.rows[0].count, data: null, error: null };
      }
      if (this.operation !== 'select') {
        return { data: null, error: null };
      }
      const rows = result.rows.map(normalizeRow);
      return { data: this.single ? rows[0] || null : rows, error: null };
    } catch (error) {
      return { data: null, error: { message: error.message, code: error.code } };
    }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
}

function serialize(value) {
  if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])
  );
}

function createPgliteSupabaseClient(db) {
  return {
    from(table) {
      return new QueryBuilder(db, table);
    },
    async rpc(name, params) {
      const keys = Object.keys(params);
      const args = keys.map((key, index) => `${key} => $${index + 1}`).join(', ');
      try {
        const result = await db.query(`select public.${name}(${args}) as result`, keys.map((key) => serialize(params[key])));
        return { data: result.rows[0].result, error: null };
      } catch (error) {
        return { data: null, error: { message: error.message, code: error.code } };
      }
    },
  };
}

module.exports = { createPgliteSupabaseClient };
