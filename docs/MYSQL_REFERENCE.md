# MySQL SQL Language Reference

This document summarizes MySQL-specific SQL features relevant to the `sql-type-parser`.
For complete documentation, see the [MySQL Official Documentation](https://dev.mysql.com/doc/refman/8.0/en/).

## Official Documentation Links

| Section | URL |
| ------- | --- |
| **SQL Statements** | https://dev.mysql.com/doc/refman/8.0/en/sql-statements.html |
| **Functions & Operators** | https://dev.mysql.com/doc/refman/8.0/en/functions.html |
| **Data Types** | https://dev.mysql.com/doc/refman/8.0/en/data-types.html |
| **SELECT Statement** | https://dev.mysql.com/doc/refman/8.0/en/select.html |
| **JSON Functions** | https://dev.mysql.com/doc/refman/8.0/en/json-functions.html |

---

## 1. Operators

### 1.1 Comparison Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `=` | Equal | `a = b` |
| `<=>` | NULL-safe equal (returns 1 for NULL = NULL) | `a <=> b` |
| `<>` or `!=` | Not equal | `a <> b` |
| `<` | Less than | `a < b` |
| `>` | Greater than | `a > b` |
| `<=` | Less than or equal | `a <= b` |
| `>=` | Greater than or equal | `a >= b` |
| `BETWEEN ... AND ...` | Between range (inclusive) | `a BETWEEN 1 AND 10` |
| `NOT BETWEEN ... AND ...` | Not between range | `a NOT BETWEEN 1 AND 10` |
| `IN (...)` | In a set of values | `a IN (1, 2, 3)` |
| `NOT IN (...)` | Not in a set | `a NOT IN (1, 2, 3)` |
| `IS NULL` | Is null | `a IS NULL` |
| `IS NOT NULL` | Is not null | `a IS NOT NULL` |
| `LIKE` | Pattern matching with wildcards | `name LIKE 'J%'` |
| `NOT LIKE` | Negated pattern matching | `name NOT LIKE 'J%'` |
| `COALESCE(...)` | First non-NULL argument | `COALESCE(a, b, c)` |
| `GREATEST(...)` | Largest argument | `GREATEST(1, 2, 3)` |
| `LEAST(...)` | Smallest argument | `LEAST(1, 2, 3)` |

### 1.2 Logical Operators

| Operator | Description |
| -------- | ----------- |
| `AND` / `&&` | Logical AND |
| `OR` / `\|\|` | Logical OR |
| `NOT` / `!` | Logical NOT |
| `XOR` | Logical XOR |

### 1.3 Arithmetic Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `+` | Addition | `a + b` |
| `-` | Subtraction | `a - b` |
| `*` | Multiplication | `a * b` |
| `/` | Division | `a / b` |
| `DIV` | Integer division | `a DIV b` |
| `%` / `MOD` | Modulo | `a % b` |
| `-` | Unary minus (negation) | `-a` |

### 1.4 Bitwise Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `&` | Bitwise AND | `a & b` |
| `\|` | Bitwise OR | `a \| b` |
| `^` | Bitwise XOR | `a ^ b` |
| `~` | Bitwise NOT (inversion) | `~a` |
| `<<` | Left shift | `a << n` |
| `>>` | Right shift | `a >> n` |

### 1.5 String Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `LIKE` | Pattern matching | `'abc' LIKE 'a%'` |
| `NOT LIKE` | Negated pattern matching | `'abc' NOT LIKE 'b%'` |
| `REGEXP` / `RLIKE` | Regular expression match | `'abc' REGEXP '^a'` |
| `NOT REGEXP` | Negated regex match | `'abc' NOT REGEXP '^b'` |
| `SOUNDS LIKE` | Soundex comparison | `'smith' SOUNDS LIKE 'smyth'` |

### 1.6 JSON Operators

| Operator | Description | Example | Result |
| -------- | ----------- | ------- | ------ |
| `->` | Extract JSON value | `doc->'$.name'` | JSON |
| `->>` | Extract JSON value as text | `doc->>'$.name'` | Text |

### 1.7 Assignment Operators

| Operator | Description | Example |
| -------- | ----------- | ------- |
| `=` | Assignment (in SET) | `SET @var = 1` |
| `:=` | Assignment (anywhere) | `SELECT @var := 1` |

---

## 2. Data Types

### 2.1 Numeric Types

| Type | Size | Description | Range |
| ---- | ---- | ----------- | ----- |
| `TINYINT` | 1 byte | Very small integer | -128 to 127 (signed), 0 to 255 (unsigned) |
| `SMALLINT` | 2 bytes | Small integer | -32768 to 32767 |
| `MEDIUMINT` | 3 bytes | Medium integer | -8388608 to 8388607 |
| `INT` / `INTEGER` | 4 bytes | Standard integer | -2147483648 to 2147483647 |
| `BIGINT` | 8 bytes | Large integer | -9223372036854775808 to 9223372036854775807 |
| `DECIMAL(M,D)` / `NUMERIC` | variable | Fixed-point | Depends on M and D |
| `FLOAT` | 4 bytes | Single-precision float | ~7 decimal digits |
| `DOUBLE` / `REAL` | 8 bytes | Double-precision float | ~15 decimal digits |
| `BIT(M)` | varies | Bit-field | 1 to 64 bits |

### 2.2 String Types

| Type | Description |
| ---- | ----------- |
| `CHAR(M)` | Fixed-length string (0-255 chars) |
| `VARCHAR(M)` | Variable-length string (0-65535 chars) |
| `BINARY(M)` | Fixed-length binary string |
| `VARBINARY(M)` | Variable-length binary string |
| `TINYBLOB` | Tiny binary large object (255 bytes) |
| `BLOB` | Binary large object (64 KB) |
| `MEDIUMBLOB` | Medium binary large object (16 MB) |
| `LONGBLOB` | Long binary large object (4 GB) |
| `TINYTEXT` | Tiny text (255 chars) |
| `TEXT` | Text (64 KB) |
| `MEDIUMTEXT` | Medium text (16 MB) |
| `LONGTEXT` | Long text (4 GB) |
| `ENUM('val1','val2',...)` | Enumeration |
| `SET('val1','val2',...)` | Set of values |

### 2.3 Date/Time Types

| Type | Format | Description |
| ---- | ------ | ----------- |
| `DATE` | 'YYYY-MM-DD' | Date value |
| `TIME` | 'HH:MM:SS' | Time value |
| `DATETIME` | 'YYYY-MM-DD HH:MM:SS' | Date and time |
| `TIMESTAMP` | 'YYYY-MM-DD HH:MM:SS' | Timestamp (auto-update capable) |
| `YEAR` | YYYY | Year value (1901-2155) |

### 2.4 JSON Type

| Type | Description |
| ---- | ----------- |
| `JSON` | Native JSON data type |

### 2.5 Spatial Types

| Type | Description |
| ---- | ----------- |
| `GEOMETRY` | Any geometry type |
| `POINT` | Single point |
| `LINESTRING` | Line |
| `POLYGON` | Polygon |
| `MULTIPOINT` | Collection of points |
| `MULTILINESTRING` | Collection of lines |
| `MULTIPOLYGON` | Collection of polygons |
| `GEOMETRYCOLLECTION` | Collection of geometries |

---

## 3. SQL Syntax

### 3.1 SELECT Statement

```sql
SELECT
    [ALL | DISTINCT | DISTINCTROW]
    [HIGH_PRIORITY]
    [STRAIGHT_JOIN]
    [SQL_SMALL_RESULT | SQL_BIG_RESULT] [SQL_BUFFER_RESULT]
    [SQL_NO_CACHE] [SQL_CALC_FOUND_ROWS]
    select_expr [, select_expr] ...
    [into_option]
    [FROM table_references
      [PARTITION partition_list]]
    [WHERE where_condition]
    [GROUP BY {col_name | expr | position} [ASC | DESC], ... [WITH ROLLUP]]
    [HAVING where_condition]
    [WINDOW window_name AS (window_spec) [, window_name AS (window_spec)] ...]
    [ORDER BY {col_name | expr | position} [ASC | DESC], ... [WITH ROLLUP]]
    [LIMIT {[offset,] row_count | row_count OFFSET offset}]
    [into_option]
    [FOR {UPDATE | SHARE}
        [OF tbl_name [, tbl_name] ...]
        [NOWAIT | SKIP LOCKED]
      | LOCK IN SHARE MODE]
    [into_option]
```

### 3.2 INSERT Statement

```sql
INSERT [LOW_PRIORITY | DELAYED | HIGH_PRIORITY] [IGNORE]
    [INTO] tbl_name
    [PARTITION (partition_name [, partition_name] ...)]
    [(col_name [, col_name] ...)]
    { {VALUES | VALUE} (value_list) [, (value_list)] ...
      |
      VALUES row_constructor_list
    }
    [AS row_alias[(col_alias [, col_alias] ...)]]
    [ON DUPLICATE KEY UPDATE assignment_list]

INSERT [LOW_PRIORITY | DELAYED | HIGH_PRIORITY] [IGNORE]
    [INTO] tbl_name
    [PARTITION (partition_name [, partition_name] ...)]
    SET assignment_list
    [AS row_alias[(col_alias [, col_alias] ...)]]
    [ON DUPLICATE KEY UPDATE assignment_list]

INSERT [LOW_PRIORITY | HIGH_PRIORITY] [IGNORE]
    [INTO] tbl_name
    [PARTITION (partition_name [, partition_name] ...)]
    [(col_name [, col_name] ...)]
    { SELECT ... | TABLE table_name }
    [ON DUPLICATE KEY UPDATE assignment_list]
```

### 3.3 UPDATE Statement

```sql
UPDATE [LOW_PRIORITY] [IGNORE] table_reference
    SET assignment_list
    [WHERE where_condition]
    [ORDER BY ...]
    [LIMIT row_count]

-- Multi-table UPDATE
UPDATE [LOW_PRIORITY] [IGNORE] table_references
    SET assignment_list
    [WHERE where_condition]
```

### 3.4 DELETE Statement

```sql
-- Single-table DELETE
DELETE [LOW_PRIORITY] [QUICK] [IGNORE] FROM tbl_name [[AS] tbl_alias]
    [PARTITION (partition_name [, partition_name] ...)]
    [WHERE where_condition]
    [ORDER BY ...]
    [LIMIT row_count]

-- Multi-table DELETE
DELETE [LOW_PRIORITY] [QUICK] [IGNORE]
    tbl_name[.*] [, tbl_name[.*]] ...
    FROM table_references
    [WHERE where_condition]
```

### 3.5 REPLACE Statement (MySQL-specific)

```sql
REPLACE [LOW_PRIORITY | DELAYED]
    [INTO] tbl_name
    [PARTITION (partition_name [, partition_name] ...)]
    [(col_name [, col_name] ...)]
    { {VALUES | VALUE} (value_list) [, (value_list)] ... }

REPLACE [LOW_PRIORITY | DELAYED]
    [INTO] tbl_name
    [PARTITION (partition_name [, partition_name] ...)]
    SET assignment_list

REPLACE [LOW_PRIORITY | DELAYED]
    [INTO] tbl_name
    [PARTITION (partition_name [, partition_name] ...)]
    [(col_name [, col_name] ...)]
    {SELECT ... | TABLE table_name}
```

### 3.6 INSERT ... ON DUPLICATE KEY UPDATE

```sql
INSERT INTO users (id, name, email)
VALUES (1, 'John', 'john@example.com')
ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email);

-- MySQL 8.0.19+ alias syntax
INSERT INTO users (id, name, email)
VALUES (1, 'John', 'john@example.com') AS new
ON DUPLICATE KEY UPDATE name = new.name, email = new.email;
```

### 3.7 INSERT IGNORE

```sql
INSERT IGNORE INTO users (id, name, email)
VALUES (1, 'John', 'john@example.com');
-- Silently ignores duplicate key errors
```

### 3.8 LIMIT Syntax Variations

```sql
-- Standard
SELECT * FROM users LIMIT 10;

-- With offset (MySQL-style)
SELECT * FROM users LIMIT 10, 20;  -- Skip 10, return 20

-- With OFFSET keyword
SELECT * FROM users LIMIT 20 OFFSET 10;
```

### 3.9 Backtick Quoting

MySQL uses backticks for identifiers (instead of double quotes):

```sql
SELECT `column`, `table`.`field`
FROM `schema`.`table`
WHERE `column` = 'value';
```

### 3.10 GROUP BY WITH ROLLUP

```sql
SELECT year, country, product, SUM(profit)
FROM sales
GROUP BY year, country, product WITH ROLLUP;
```

### 3.11 Index Hints

```sql
SELECT * FROM t1 USE INDEX (i1) IGNORE INDEX FOR ORDER BY (i2) ...
SELECT * FROM t1 FORCE INDEX (i1, i2) ...
SELECT * FROM t1 IGNORE INDEX (i1) ...

-- Hint types: USE INDEX, FORCE INDEX, IGNORE INDEX
-- For clauses: FOR JOIN, FOR ORDER BY, FOR GROUP BY
```

### 3.12 Window Functions

```sql
SELECT
    department,
    employee,
    salary,
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rank,
    SUM(salary) OVER (PARTITION BY department) AS dept_total,
    AVG(salary) OVER () AS company_avg
FROM employees;

-- Named windows
SELECT
    employee,
    salary,
    SUM(salary) OVER w AS running_total,
    AVG(salary) OVER w AS running_avg
FROM employees
WINDOW w AS (ORDER BY hire_date);
```

### 3.13 Common Table Expressions (CTE)

```sql
WITH cte AS (
    SELECT id, name, manager_id
    FROM employees
    WHERE manager_id IS NULL
)
SELECT * FROM cte;

-- Recursive CTE
WITH RECURSIVE cte AS (
    SELECT id, name, manager_id, 1 AS level
    FROM employees
    WHERE manager_id IS NULL
    UNION ALL
    SELECT e.id, e.name, e.manager_id, cte.level + 1
    FROM employees e
    JOIN cte ON e.manager_id = cte.id
)
SELECT * FROM cte;
```

---

## 4. JSON Functions

### 4.1 JSON Creation

| Function | Description |
| -------- | ----------- |
| `JSON_ARRAY(val1, val2, ...)` | Create JSON array |
| `JSON_OBJECT(key1, val1, ...)` | Create JSON object |
| `JSON_QUOTE(string)` | Quote string as JSON |

### 4.2 JSON Extraction

| Function | Description |
| -------- | ----------- |
| `JSON_EXTRACT(json, path[, path]...)` | Extract data from JSON |
| `->` | Shorthand for JSON_EXTRACT |
| `->>` | Shorthand for JSON_UNQUOTE(JSON_EXTRACT()) |
| `JSON_KEYS(json[, path])` | Get keys from JSON object |
| `JSON_VALUE(json, path)` | Extract scalar value |

### 4.3 JSON Modification

| Function | Description |
| -------- | ----------- |
| `JSON_SET(json, path, val[, ...])` | Insert/update values |
| `JSON_INSERT(json, path, val[, ...])` | Insert values (no overwrite) |
| `JSON_REPLACE(json, path, val[, ...])` | Replace values |
| `JSON_REMOVE(json, path[, ...])` | Remove elements |
| `JSON_ARRAY_APPEND(json, path, val[, ...])` | Append to array |
| `JSON_ARRAY_INSERT(json, path, val[, ...])` | Insert into array |
| `JSON_MERGE_PATCH(json, json[, ...])` | Merge (RFC 7396) |
| `JSON_MERGE_PRESERVE(json, json[, ...])` | Merge preserving arrays |

### 4.4 JSON Search

| Function | Description |
| -------- | ----------- |
| `JSON_CONTAINS(json, val[, path])` | Check if contains value |
| `JSON_CONTAINS_PATH(json, one_or_all, path[, ...])` | Check if path exists |
| `JSON_SEARCH(json, one_or_all, search_str[, ...])` | Search for string |
| `JSON_OVERLAPS(json1, json2)` | Check for overlap |
| `MEMBER OF(val MEMBER OF(json))` | Check membership |

### 4.5 JSON Info

| Function | Description |
| -------- | ----------- |
| `JSON_TYPE(json)` | Return JSON type |
| `JSON_VALID(val)` | Check if valid JSON |
| `JSON_LENGTH(json[, path])` | Return length |
| `JSON_DEPTH(json)` | Return maximum depth |

---

## 5. Full-Text Search

### 5.1 MATCH ... AGAINST

```sql
-- Natural language mode (default)
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST('database');

-- Boolean mode
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST('+MySQL -YourSQL' IN BOOLEAN MODE);

-- With query expansion
SELECT * FROM articles
WHERE MATCH(title, body) AGAINST('database' WITH QUERY EXPANSION);
```

### 5.2 Boolean Mode Operators

| Operator | Description |
| -------- | ----------- |
| `+` | Word must be present |
| `-` | Word must not be present |
| `>` | Increase relevance contribution |
| `<` | Decrease relevance contribution |
| `()` | Group words into subexpressions |
| `~` | Negate word's contribution to relevance |
| `*` | Wildcard at end of word |
| `""` | Phrase search |

---

## 6. Common Functions

### 6.1 Aggregate Functions

- `COUNT(*)`, `COUNT(expr)`, `COUNT(DISTINCT expr)`
- `SUM(expr)`, `AVG(expr)`
- `MIN(expr)`, `MAX(expr)`
- `GROUP_CONCAT(expr [ORDER BY] [SEPARATOR])`
- `JSON_ARRAYAGG(expr)`
- `JSON_OBJECTAGG(key, value)`
- `BIT_AND(expr)`, `BIT_OR(expr)`, `BIT_XOR(expr)`
- `STD(expr)`, `STDDEV(expr)`, `VARIANCE(expr)`

### 6.2 Window Functions

- `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`
- `NTILE(n)`
- `LAG(expr, n, default)`, `LEAD(expr, n, default)`
- `FIRST_VALUE(expr)`, `LAST_VALUE(expr)`
- `NTH_VALUE(expr, n)`
- `CUME_DIST()`, `PERCENT_RANK()`

### 6.3 String Functions

- `CONCAT(str1, str2, ...)`
- `CONCAT_WS(separator, str1, str2, ...)`
- `SUBSTRING(str, pos, len)` / `SUBSTR(str, pos, len)`
- `LEFT(str, len)`, `RIGHT(str, len)`
- `TRIM([LEADING|TRAILING|BOTH] [remstr] FROM str)`
- `UPPER(str)`, `LOWER(str)`, `UCASE(str)`, `LCASE(str)`
- `REPLACE(str, from_str, to_str)`
- `REGEXP_REPLACE(str, pattern, replace)`
- `REGEXP_SUBSTR(str, pattern)`
- `REGEXP_INSTR(str, pattern)`
- `REGEXP_LIKE(str, pattern)`

### 6.4 Date/Time Functions

- `NOW()`, `CURRENT_TIMESTAMP`
- `CURDATE()`, `CURRENT_DATE`
- `CURTIME()`, `CURRENT_TIME`
- `DATE(expr)`, `TIME(expr)`
- `DATE_ADD(date, INTERVAL expr unit)`, `DATE_SUB(date, INTERVAL expr unit)`
- `DATEDIFF(date1, date2)`
- `TIMESTAMPDIFF(unit, datetime1, datetime2)`
- `DATE_FORMAT(date, format)`
- `STR_TO_DATE(str, format)`
- `EXTRACT(unit FROM date)`
- `YEAR(date)`, `MONTH(date)`, `DAY(date)`
- `HOUR(time)`, `MINUTE(time)`, `SECOND(time)`

### 6.5 Control Flow Functions

- `IF(expr, val_if_true, val_if_false)`
- `IFNULL(expr1, expr2)`
- `NULLIF(expr1, expr2)`
- `CASE WHEN condition THEN result [ELSE result] END`
- `COALESCE(val1, val2, ...)`

### 6.6 Cast Functions

- `CAST(expr AS type)`
- `CONVERT(expr, type)` / `CONVERT(expr USING charset)`
- Types: `BINARY`, `CHAR`, `DATE`, `DATETIME`, `DECIMAL`, `DOUBLE`, `FLOAT`, `JSON`, `SIGNED`, `TIME`, `UNSIGNED`, `YEAR`

---

## References

- MySQL 8.0 Reference Manual: https://dev.mysql.com/doc/refman/8.0/en/
- SQL Statements: https://dev.mysql.com/doc/refman/8.0/en/sql-statements.html
- Functions and Operators: https://dev.mysql.com/doc/refman/8.0/en/functions.html
- Data Types: https://dev.mysql.com/doc/refman/8.0/en/data-types.html
- SELECT Statement: https://dev.mysql.com/doc/refman/8.0/en/select.html
- JSON Functions: https://dev.mysql.com/doc/refman/8.0/en/json-functions.html
- Full-Text Search: https://dev.mysql.com/doc/refman/8.0/en/fulltext-search.html

