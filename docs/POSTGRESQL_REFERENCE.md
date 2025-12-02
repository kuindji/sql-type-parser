# PostgreSQL SQL Language Reference

This document summarizes PostgreSQL-specific SQL features relevant to the `sql-type-parser`.
For complete documentation, see the [PostgreSQL Official Documentation](https://www.postgresql.org/docs/current/).

## Official Documentation Links

| Section | URL |
| ------- | --- |
| **SQL Language** | https://www.postgresql.org/docs/current/sql.html |
| **SQL Syntax** | https://www.postgresql.org/docs/current/sql-syntax.html |
| **Data Types** | https://www.postgresql.org/docs/current/datatype.html |
| **Functions & Operators** | https://www.postgresql.org/docs/current/functions.html |
| **SQL Commands** | https://www.postgresql.org/docs/current/sql-commands.html |

---

## 1. Operators

### 1.1 Comparison Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `=` | Equal | `a = b` |
| `<>` or `!=` | Not equal | `a <> b` |
| `<` | Less than | `a < b` |
| `>` | Greater than | `a > b` |
| `<=` | Less than or equal | `a <= b` |
| `>=` | Greater than or equal | `a >= b` |
| `BETWEEN` | Between range (inclusive) | `a BETWEEN x AND y` |
| `NOT BETWEEN` | Not between range | `a NOT BETWEEN x AND y` |
| `IS NULL` | Is null | `a IS NULL` |
| `IS NOT NULL` | Is not null | `a IS NOT NULL` |
| `IS DISTINCT FROM` | Not equal, treating null as comparable | `a IS DISTINCT FROM b` |
| `IS NOT DISTINCT FROM` | Equal, treating null as comparable | `a IS NOT DISTINCT FROM b` |

### 1.2 Logical Operators

| Operator | Description |
| -------- | ----------- |
| `AND` | Logical conjunction |
| `OR` | Logical disjunction |
| `NOT` | Logical negation |

### 1.3 Mathematical Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `+` | Addition | `2 + 3` |
| `-` | Subtraction | `2 - 3` |
| `*` | Multiplication | `2 * 3` |
| `/` | Division | `4 / 2` |
| `%` | Modulo (remainder) | `5 % 4` |
| `^` | Exponentiation | `2.0 ^ 3.0` |
| `\|/` | Square root | `\|/ 25.0` |
| `\|\|/` | Cube root | `\|\|/ 27.0` |
| `@` | Absolute value | `@ -5.0` |
| `&` | Bitwise AND | `91 & 15` |
| `\|` | Bitwise OR | `32 \| 3` |
| `#` | Bitwise XOR | `17 # 5` |
| `~` | Bitwise NOT | `~1` |
| `<<` | Bitwise shift left | `1 << 4` |
| `>>` | Bitwise shift right | `8 >> 2` |

### 1.4 String Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `\|\|` | String concatenation | `'Post' \|\| 'greSQL'` |
| `LIKE` | Pattern matching | `'abc' LIKE 'a%'` |
| `ILIKE` | Case-insensitive pattern matching | `'abc' ILIKE 'A%'` |
| `SIMILAR TO` | SQL regex pattern matching | `'abc' SIMILAR TO 'a%'` |
| `~` | POSIX regex match (case sensitive) | `'thomas' ~ 't.*ma'` |
| `~*` | POSIX regex match (case insensitive) | `'thomas' ~* 'T.*ma'` |
| `!~` | POSIX regex not match (case sensitive) | `'thomas' !~ 't.*max'` |
| `!~*` | POSIX regex not match (case insensitive) | `'thomas' !~* 'T.*MAX'` |

### 1.5 Array Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `@>` | Contains | `ARRAY[1,4,3] @> ARRAY[3,1]` |
| `<@` | Is contained by | `ARRAY[2,7] <@ ARRAY[1,7,4,2,6]` |
| `&&` | Overlap (have elements in common) | `ARRAY[1,4,3] && ARRAY[2,1]` |
| `\|\|` | Array concatenation | `ARRAY[1,2,3] \|\| ARRAY[4,5,6]` |
| `[n]` | Array subscript | `arr[1]` |
| `[n:m]` | Array slice | `arr[1:3]` |

### 1.6 JSON/JSONB Operators

| Operator | Description | Example | Result Type |
| -------- | ----------- | ------- | ----------- |
| `->` | Get JSON object field by key | `'{"a":1}'::json -> 'a'` | json |
| `->>` | Get JSON object field as text | `'{"a":1}'::json ->> 'a'` | text |
| `#>` | Get JSON object at path | `'{"a":{"b":1}}'::json #> '{a,b}'` | json |
| `#>>` | Get JSON object at path as text | `'{"a":{"b":1}}'::json #>> '{a,b}'` | text |
| `@>` | Contains (JSONB only) | `'{"a":1}'::jsonb @> '{"a":1}'` | boolean |
| `<@` | Is contained by (JSONB only) | `'{"a":1}'::jsonb <@ '{"a":1,"b":2}'` | boolean |
| `?` | Key exists (JSONB only) | `'{"a":1}'::jsonb ? 'a'` | boolean |
| `?\|` | Any key exists (JSONB only) | `'{"a":1}'::jsonb ?\| array['a','b']` | boolean |
| `?&` | All keys exist (JSONB only) | `'{"a":1,"b":2}'::jsonb ?& array['a','b']` | boolean |
| `\|\|` | Concatenate (JSONB only) | `'{"a":1}'::jsonb \|\| '{"b":2}'::jsonb` | jsonb |
| `-` | Delete key (JSONB only) | `'{"a":1,"b":2}'::jsonb - 'a'` | jsonb |
| `#-` | Delete at path (JSONB only) | `'{"a":{"b":1}}'::jsonb #- '{a,b}'` | jsonb |
| `@?` | JSON path exists (JSONB only) | `'{"a":1}'::jsonb @? '$.a'` | boolean |
| `@@` | JSON path predicate check | `'{"a":1}'::jsonb @@ '$.a == 1'` | boolean |

### 1.7 Full-Text Search Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `@@` | Text search match | `to_tsvector('fat cats') @@ to_tsquery('cat')` |
| `\|\|` | Concatenate tsvector | `'a:1'::tsvector \|\| 'b:2'::tsvector` |
| `&&` | AND tsquery | `'fat'::tsquery && 'rat'::tsquery` |
| `\|\|` | OR tsquery | `'fat'::tsquery \|\| 'rat'::tsquery` |
| `!!` | NOT tsquery | `!! 'cat'::tsquery` |
| `<->` | Followed by (PHRASE) | `'cat'::tsquery <-> 'rat'::tsquery` |
| `@>` | Contains tsquery | `'cat & rat'::tsquery @> 'rat'::tsquery` |
| `<@` | Is contained by tsquery | `'rat'::tsquery <@ 'cat & rat'::tsquery` |

### 1.8 Geometric Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `+` | Translation | `box '((0,0),(1,1))' + point '(2,0)'` |
| `-` | Translation | `box '((0,0),(1,1))' - point '(2,0)'` |
| `*` | Scaling/rotation | `box '((0,0),(1,1))' * point '(2,0)'` |
| `/` | Scaling/rotation | `box '((0,0),(2,2))' / point '(2,0)'` |
| `#` | Intersection point or box | `lseg '((0,0),(1,1))' # lseg '((0,1),(1,0))'` |
| `##` | Closest point | `point '(0,0)' ## lseg '((2,0),(0,2))'` |
| `<->` | Distance between | `circle '((0,0),1)' <-> circle '((5,0),1)'` |
| `<#>` | Distance (bounding box) | `box '((0,0),(1,1))' <#> box '((2,2),(3,3))'` |
| `@>` | Contains | `circle '((0,0),2)' @> point '(1,1)'` |
| `<@` | Contained by | `point '(1,1)' <@ circle '((0,0),2)'` |
| `&&` | Overlaps | `box '((0,0),(1,1))' && box '((0,0),(2,2))'` |
| `<<` | Is strictly left of | `circle '((0,0),1)' << circle '((5,0),1)'` |
| `>>` | Is strictly right of | `circle '((5,0),1)' >> circle '((0,0),1)'` |
| `&<` | Does not extend to the right of | `box '((0,0),(1,1))' &< box '((0,0),(2,2))'` |
| `&>` | Does not extend to the left of | `box '((0,0),(3,3))' &> box '((0,0),(2,2))'` |
| `<<\|` | Is strictly below | `box '((0,0),(3,3))' <<\| box '((3,4),(5,5))'` |
| `\|>>` | Is strictly above | `box '((3,4),(5,5))' \|>> box '((0,0),(3,3))'` |
| `&<\|` | Does not extend above | `box '((0,0),(1,1))' &<\| box '((0,0),(2,2))'` |
| `\|&>` | Does not extend below | `box '((0,0),(3,3))' \|&> box '((0,0),(2,2))'` |
| `~=` | Same as | `polygon '((0,0),(1,1))' ~= polygon '((1,1),(0,0))'` |

### 1.9 Range Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `@>` | Contains range/element | `int4range(1,10) @> 5` |
| `<@` | Is contained by | `5 <@ int4range(1,10)` |
| `&&` | Overlap | `int4range(1,10) && int4range(5,15)` |
| `<<` | Strictly left of | `int4range(1,5) << int4range(10,20)` |
| `>>` | Strictly right of | `int4range(10,20) >> int4range(1,5)` |
| `&<` | Does not extend to the right of | `int4range(1,10) &< int4range(5,15)` |
| `&>` | Does not extend to the left of | `int4range(5,15) &> int4range(1,10)` |
| `-\|-` | Is adjacent to | `int4range(1,5) -\|- int4range(5,10)` |
| `+` | Union | `int4range(1,5) + int4range(5,10)` |
| `*` | Intersection | `int4range(1,10) * int4range(5,15)` |
| `-` | Difference | `int4range(1,10) - int4range(5,15)` |

### 1.10 Network Address Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `<` | Less than | `inet '192.168.1.5' < inet '192.168.1.6'` |
| `<=` | Less than or equal | `inet '192.168.1.5' <= inet '192.168.1.5'` |
| `=` | Equal | `inet '192.168.1.5' = inet '192.168.1.5'` |
| `>=` | Greater than or equal | `inet '192.168.1.5' >= inet '192.168.1.5'` |
| `>` | Greater than | `inet '192.168.1.5' > inet '192.168.1.4'` |
| `<>` | Not equal | `inet '192.168.1.5' <> inet '192.168.1.4'` |
| `<<` | Is contained by | `inet '192.168.1.5' << inet '192.168.1/24'` |
| `<<=` | Is contained by or equals | `inet '192.168.1/24' <<= inet '192.168.1/24'` |
| `>>` | Contains | `inet '192.168.1/24' >> inet '192.168.1.5'` |
| `>>=` | Contains or equals | `inet '192.168.1/24' >>= inet '192.168.1/24'` |
| `&&` | Contains or is contained by | `inet '192.168.1/24' && inet '192.168.1.80/28'` |
| `~` | Bitwise NOT | `~ inet '192.168.1.6'` |
| `&` | Bitwise AND | `inet '192.168.1.6' & inet '0.0.0.255'` |
| `\|` | Bitwise OR | `inet '192.168.1.6' \| inet '0.0.0.255'` |
| `+` | Addition | `inet '192.168.1.6' + 25` |
| `-` | Subtraction | `inet '192.168.1.6' - 25` |

---

## 2. Data Types

### 2.1 Numeric Types

| Type | Size | Description | Range |
| ---- | ---- | ----------- | ----- |
| `smallint` / `int2` | 2 bytes | Small-range integer | -32768 to +32767 |
| `integer` / `int` / `int4` | 4 bytes | Typical choice for integer | -2147483648 to +2147483647 |
| `bigint` / `int8` | 8 bytes | Large-range integer | -9223372036854775808 to +9223372036854775807 |
| `decimal` / `numeric` | variable | User-specified precision | Up to 131072 digits before decimal point; up to 16383 digits after |
| `real` / `float4` | 4 bytes | Variable-precision, inexact | 6 decimal digits precision |
| `double precision` / `float8` | 8 bytes | Variable-precision, inexact | 15 decimal digits precision |
| `smallserial` / `serial2` | 2 bytes | Small autoincrementing integer | 1 to 32767 |
| `serial` / `serial4` | 4 bytes | Autoincrementing integer | 1 to 2147483647 |
| `bigserial` / `serial8` | 8 bytes | Large autoincrementing integer | 1 to 9223372036854775807 |

### 2.2 Character Types

| Type | Description |
| ---- | ----------- |
| `character varying(n)` / `varchar(n)` | Variable-length with limit |
| `character(n)` / `char(n)` | Fixed-length, blank padded |
| `text` | Variable unlimited length |

### 2.3 Binary Types

| Type | Description |
| ---- | ----------- |
| `bytea` | Variable-length binary string |

### 2.4 Date/Time Types

| Type | Size | Description |
| ---- | ---- | ----------- |
| `timestamp` | 8 bytes | Date and time (no time zone) |
| `timestamp with time zone` / `timestamptz` | 8 bytes | Date and time (with time zone) |
| `date` | 4 bytes | Date (no time of day) |
| `time` | 8 bytes | Time of day (no date, no time zone) |
| `time with time zone` / `timetz` | 12 bytes | Time of day with time zone |
| `interval` | 16 bytes | Time interval |

### 2.5 Boolean Type

| Type | Description |
| ---- | ----------- |
| `boolean` / `bool` | true/false |

### 2.6 UUID Type

| Type | Description |
| ---- | ----------- |
| `uuid` | Universally unique identifier |

### 2.7 JSON Types

| Type | Description |
| ---- | ----------- |
| `json` | Textual JSON data |
| `jsonb` | Binary JSON data, decomposed |

### 2.8 Array Types

Any base type can be made into an array by appending `[]`:
- `integer[]` - Array of integers
- `text[][]` - Two-dimensional array of text

### 2.9 Range Types

| Type | Description |
| ---- | ----------- |
| `int4range` | Range of integer |
| `int8range` | Range of bigint |
| `numrange` | Range of numeric |
| `tsrange` | Range of timestamp without time zone |
| `tstzrange` | Range of timestamp with time zone |
| `daterange` | Range of date |

### 2.10 Geometric Types

| Type | Description |
| ---- | ----------- |
| `point` | Point on a plane |
| `line` | Infinite line |
| `lseg` | Line segment |
| `box` | Rectangular box |
| `path` | Geometric path |
| `polygon` | Polygon |
| `circle` | Circle |

### 2.11 Network Address Types

| Type | Description |
| ---- | ----------- |
| `cidr` | IPv4 or IPv6 network |
| `inet` | IPv4 or IPv6 host address |
| `macaddr` | MAC address |
| `macaddr8` | MAC address (EUI-64 format) |

### 2.12 Text Search Types

| Type | Description |
| ---- | ----------- |
| `tsvector` | Text search document |
| `tsquery` | Text search query |

### 2.13 Other Types

| Type | Description |
| ---- | ----------- |
| `money` | Currency amount |
| `bit(n)` | Fixed-length bit string |
| `bit varying(n)` / `varbit(n)` | Variable-length bit string |
| `xml` | XML data |
| `hstore` | Key-value pairs (extension) |

---

## 3. SQL Clauses and Syntax

### 3.1 SELECT Statement

```sql
[ WITH [ RECURSIVE ] with_query [, ...] ]
SELECT [ ALL | DISTINCT [ ON ( expression [, ...] ) ] ]
    [ * | expression [ [ AS ] output_name ] [, ...] ]
    [ FROM from_item [, ...] ]
    [ WHERE condition ]
    [ GROUP BY [ ALL | DISTINCT ] grouping_element [, ...] ]
    [ HAVING condition ]
    [ WINDOW window_name AS ( window_definition ) [, ...] ]
    [ { UNION | INTERSECT | EXCEPT } [ ALL | DISTINCT ] select ]
    [ ORDER BY expression [ ASC | DESC | USING operator ] [ NULLS { FIRST | LAST } ] [, ...] ]
    [ LIMIT { count | ALL } ]
    [ OFFSET start [ ROW | ROWS ] ]
    [ FETCH { FIRST | NEXT } [ count ] { ROW | ROWS } { ONLY | WITH TIES } ]
    [ FOR { UPDATE | NO KEY UPDATE | SHARE | KEY SHARE } [ OF table_name [, ...] ] [ NOWAIT | SKIP LOCKED ] [...] ]
```

### 3.2 INSERT Statement

```sql
[ WITH [ RECURSIVE ] with_query [, ...] ]
INSERT INTO table_name [ AS alias ] [ ( column_name [, ...] ) ]
    [ OVERRIDING { SYSTEM | USER } VALUE ]
    { DEFAULT VALUES | VALUES ( { expression | DEFAULT } [, ...] ) [, ...] | query }
    [ ON CONFLICT [ conflict_target ] conflict_action ]
    [ RETURNING * | output_expression [ [ AS ] output_name ] [, ...] ]
```

### 3.3 UPDATE Statement

```sql
[ WITH [ RECURSIVE ] with_query [, ...] ]
UPDATE [ ONLY ] table_name [ * ] [ [ AS ] alias ]
    SET { column_name = { expression | DEFAULT } |
          ( column_name [, ...] ) = [ ROW ] ( { expression | DEFAULT } [, ...] ) |
          ( column_name [, ...] ) = ( sub-SELECT )
        } [, ...]
    [ FROM from_item [, ...] ]
    [ WHERE condition | WHERE CURRENT OF cursor_name ]
    [ RETURNING * | output_expression [ [ AS ] output_name ] [, ...] ]
```

### 3.4 DELETE Statement

```sql
[ WITH [ RECURSIVE ] with_query [, ...] ]
DELETE FROM [ ONLY ] table_name [ * ] [ [ AS ] alias ]
    [ USING from_item [, ...] ]
    [ WHERE condition | WHERE CURRENT OF cursor_name ]
    [ RETURNING * | output_expression [ [ AS ] output_name ] [, ...] ]
```

### 3.5 DISTINCT ON

PostgreSQL extension for selecting distinct rows by specific columns:

```sql
SELECT DISTINCT ON (column1, column2) column1, column2, column3
FROM table_name
ORDER BY column1, column2, column3;
```

### 3.6 RETURNING Clause

Returns data from modified rows:

```sql
INSERT INTO users (name, email) VALUES ('John', 'john@example.com')
RETURNING id, created_at;

UPDATE users SET email = 'new@example.com' WHERE id = 1
RETURNING *;

DELETE FROM users WHERE id = 1
RETURNING id, name;
```

### 3.7 ON CONFLICT (Upsert)

```sql
INSERT INTO users (id, name, email)
VALUES (1, 'John', 'john@example.com')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, email = EXCLUDED.email;

INSERT INTO users (id, name, email)
VALUES (1, 'John', 'john@example.com')
ON CONFLICT (id) DO NOTHING;
```

### 3.8 LATERAL Joins

```sql
SELECT *
FROM users u
CROSS JOIN LATERAL (
    SELECT * FROM orders o WHERE o.user_id = u.id ORDER BY o.created_at DESC LIMIT 3
) recent_orders;
```

### 3.9 Window Functions

```sql
SELECT
    department,
    employee,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) as rank,
    SUM(salary) OVER (PARTITION BY department) as dept_total,
    AVG(salary) OVER () as company_avg
FROM employees;
```

### 3.10 FILTER Clause

```sql
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    SUM(amount) FILTER (WHERE type = 'credit') as total_credits
FROM transactions;
```

### 3.11 Type Casting

```sql
-- PostgreSQL-specific syntax
SELECT id::text FROM users;
SELECT '2024-01-01'::date;
SELECT '{"key": "value"}'::jsonb;

-- Standard SQL syntax (also supported)
SELECT CAST(id AS text) FROM users;
```

### 3.12 Array Operations

```sql
-- Array literal
SELECT ARRAY[1, 2, 3];

-- Array subscript
SELECT arr[1] FROM table_with_array;

-- Array slice
SELECT arr[1:3] FROM table_with_array;

-- Array operators
SELECT * FROM posts WHERE tags @> ARRAY['sql', 'postgres'];
SELECT * FROM posts WHERE tags && ARRAY['sql', 'mysql'];
```

---

## 4. Common Functions

### 4.1 Aggregate Functions

- `COUNT(*)`, `COUNT(expression)`, `COUNT(DISTINCT expression)`
- `SUM(expression)`
- `AVG(expression)`
- `MIN(expression)`, `MAX(expression)`
- `ARRAY_AGG(expression)`
- `STRING_AGG(expression, delimiter)`
- `JSONB_AGG(expression)`, `JSON_AGG(expression)`
- `JSONB_OBJECT_AGG(key, value)`
- `BOOL_AND(expression)`, `BOOL_OR(expression)`

### 4.2 Window Functions

- `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`
- `NTILE(n)`
- `LAG(expression, offset, default)`, `LEAD(expression, offset, default)`
- `FIRST_VALUE(expression)`, `LAST_VALUE(expression)`
- `NTH_VALUE(expression, n)`

### 4.3 JSON Functions

- `JSON_BUILD_OBJECT(key, value, ...)`
- `JSON_BUILD_ARRAY(value, ...)`
- `JSONB_SET(target, path, new_value)`
- `JSONB_INSERT(target, path, new_value)`
- `JSONB_PATH_QUERY(target, path)`

### 4.4 String Functions

- `CONCAT(str1, str2, ...)`
- `CONCAT_WS(separator, str1, str2, ...)`
- `FORMAT(formatstr, formatarg, ...)`
- `SUBSTRING(string FROM start FOR length)`
- `TRIM([LEADING|TRAILING|BOTH] characters FROM string)`
- `UPPER(string)`, `LOWER(string)`
- `LEFT(string, n)`, `RIGHT(string, n)`
- `REGEXP_REPLACE(string, pattern, replacement)`
- `REGEXP_MATCHES(string, pattern)`

### 4.5 Date/Time Functions

- `NOW()`, `CURRENT_TIMESTAMP`
- `CURRENT_DATE`, `CURRENT_TIME`
- `DATE_TRUNC(field, source)`
- `EXTRACT(field FROM source)`
- `AGE(timestamp, timestamp)`
- `INTERVAL 'value'`

---

## References

- PostgreSQL 18 Documentation: https://www.postgresql.org/docs/current/
- SQL Syntax: https://www.postgresql.org/docs/current/sql-syntax.html
- Functions and Operators: https://www.postgresql.org/docs/current/functions.html
- Data Types: https://www.postgresql.org/docs/current/datatype.html
- SQL Commands Reference: https://www.postgresql.org/docs/current/sql-commands.html

