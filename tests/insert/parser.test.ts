/**
 * INSERT Parser Type Tests
 *
 * Tests for the ParseInsertSQL type and related parsing functionality.
 * If this file compiles without errors, all tests pass.
 */

import type {
    ParseSQL,
    ParseInsertSQL,
    SQLInsertQuery,
    InsertClause,
    InsertColumnList,
    InsertColumnRef,
    InsertValuesClause,
    InsertValueRow,
    InsertValue,
    ReturningClause,
    OnConflictClause,
    TableRef,
    UnboundColumnRef,
    ParseError,
} from "../../src/index.js"
import type { AssertEqual, AssertExtends, RequireTrue, AssertIsParseError } from "../helpers.js"

// ============================================================================
// Basic INSERT Tests
// ============================================================================

// Test: INSERT INTO table VALUES (...)
type P_BasicInsert = ParseInsertSQL<"INSERT INTO users VALUES ( 1 , 'John' , 'john@example.com' )">
type _P1 = RequireTrue<AssertExtends<P_BasicInsert, SQLInsertQuery>>

// Test: INSERT with column list
type P_WithColumns = ParseInsertSQL<"INSERT INTO users ( id , name , email ) VALUES ( 1 , 'John' , 'john@example.com' )">
type _P2 = RequireTrue<AssertExtends<P_WithColumns, SQLInsertQuery>>

// Test: Check column list is parsed
type P_WithColumns_Check = P_WithColumns extends SQLInsertQuery<infer Q>
    ? Q extends InsertClause<TableRef, InsertColumnList<[InsertColumnRef<"id">, InsertColumnRef<"name">, InsertColumnRef<"email">]>, any, any, any>
        ? true
        : false
    : false
type _P3 = RequireTrue<P_WithColumns_Check>

// Test: INSERT with schema.table
type P_SchemaTable = ParseInsertSQL<"INSERT INTO public.users ( id ) VALUES ( 1 )">
type P_SchemaTable_Check = P_SchemaTable extends SQLInsertQuery<infer Q>
    ? Q extends InsertClause<TableRef<"users", "users", "public">, any, any, any, any>
        ? true
        : false
    : false
type _P4 = RequireTrue<P_SchemaTable_Check>

// ============================================================================
// VALUES Tests
// ============================================================================

// Test: Multiple value rows
type P_MultiRow = ParseInsertSQL<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) , ( 2 , 'Jane' )">
type P_MultiRow_Check = P_MultiRow extends SQLInsertQuery<infer Q>
    ? Q extends InsertClause<any, any, InsertValuesClause<[InsertValueRow, InsertValueRow]>, any, any>
        ? true
        : false
    : false
type _P5 = RequireTrue<P_MultiRow_Check>

// Test: NULL value
type P_NullValue = ParseInsertSQL<"INSERT INTO users ( id , name ) VALUES ( 1 , NULL )">
type _P6 = RequireTrue<AssertExtends<P_NullValue, SQLInsertQuery>>

// Test: DEFAULT value
type P_DefaultValue = ParseInsertSQL<"INSERT INTO users ( id , name ) VALUES ( DEFAULT , 'John' )">
type _P7 = RequireTrue<AssertExtends<P_DefaultValue, SQLInsertQuery>>

// Test: Boolean values
type P_BoolValues = ParseInsertSQL<"INSERT INTO users ( active , verified ) VALUES ( TRUE , FALSE )">
type _P8 = RequireTrue<AssertExtends<P_BoolValues, SQLInsertQuery>>

// Test: Numeric values
type P_NumericValues = ParseInsertSQL<"INSERT INTO products ( price , quantity ) VALUES ( 19.99 , 100 )">
type _P9 = RequireTrue<AssertExtends<P_NumericValues, SQLInsertQuery>>

// Test: Parameter placeholders
type P_ParamValues = ParseInsertSQL<"INSERT INTO users ( id , name ) VALUES ( $1 , $2 )">
type _P10 = RequireTrue<AssertExtends<P_ParamValues, SQLInsertQuery>>

// ============================================================================
// RETURNING Tests
// ============================================================================

// Test: RETURNING *
type P_ReturningStar = ParseInsertSQL<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) RETURNING *">
type P_ReturningStar_Check = P_ReturningStar extends SQLInsertQuery<infer Q>
    ? Q extends InsertClause<any, any, any, any, ReturningClause<"*">>
        ? true
        : false
    : false
type _P11 = RequireTrue<P_ReturningStar_Check>

// Test: RETURNING specific columns
type P_ReturningCols = ParseInsertSQL<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) RETURNING id , name">
type P_ReturningCols_Check = P_ReturningCols extends SQLInsertQuery<infer Q>
    ? Q extends InsertClause<any, any, any, any, ReturningClause<[UnboundColumnRef<"id">, UnboundColumnRef<"name">]>>
        ? true
        : false
    : false
type _P12 = RequireTrue<P_ReturningCols_Check>

// ============================================================================
// ON CONFLICT Tests
// ============================================================================

// Test: ON CONFLICT DO NOTHING
type P_ConflictNothing = ParseInsertSQL<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) ON CONFLICT DO NOTHING">
type P_ConflictNothing_Check = P_ConflictNothing extends SQLInsertQuery<infer Q>
    ? Q extends InsertClause<any, any, any, OnConflictClause<any, "DO NOTHING", any, any>, any>
        ? true
        : false
    : false
type _P13 = RequireTrue<P_ConflictNothing_Check>

// Test: ON CONFLICT (column) DO NOTHING
type P_ConflictCol = ParseInsertSQL<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) ON CONFLICT ( id ) DO NOTHING">
type _P14 = RequireTrue<AssertExtends<P_ConflictCol, SQLInsertQuery>>

// Test: ON CONFLICT DO UPDATE
type P_ConflictUpdate = ParseInsertSQL<"INSERT INTO users ( id , name ) VALUES ( 1 , 'John' ) ON CONFLICT ( id ) DO UPDATE SET name = 'Updated'">
type P_ConflictUpdate_Check = P_ConflictUpdate extends SQLInsertQuery<infer Q>
    ? Q extends InsertClause<any, any, any, OnConflictClause<any, "DO UPDATE", any, any>, any>
        ? true
        : false
    : false
type _P15 = RequireTrue<P_ConflictUpdate_Check>

// ============================================================================
// Combined Tests
// ============================================================================

// Test: Full INSERT with all clauses
type P_Full = ParseInsertSQL<`
    INSERT INTO users ( id , name , email )
    VALUES ( 1 , 'John' , 'john@example.com' )
    ON CONFLICT ( id ) DO UPDATE SET name = 'Updated'
    RETURNING id , name
`>
type _P16 = RequireTrue<AssertExtends<P_Full, SQLInsertQuery>>

// Test: INSERT via ParseSQL (router)
type P_ViaRouter = ParseSQL<"INSERT INTO users ( id ) VALUES ( 1 )">
type _P17 = RequireTrue<AssertExtends<P_ViaRouter, SQLInsertQuery>>

// ============================================================================
// Error Cases Tests
// ============================================================================

// Test: Missing INTO
type P_NoInto = ParseInsertSQL<"INSERT users VALUES ( 1 )">
type _P18 = RequireTrue<AssertIsParseError<P_NoInto>>

// Test: Missing VALUES or SELECT
type P_NoValues = ParseInsertSQL<"INSERT INTO users ( id )">
type _P19 = RequireTrue<AssertIsParseError<P_NoValues>>

// Test: Empty query
type P_Empty = ParseInsertSQL<"">
type _P20 = RequireTrue<AssertIsParseError<P_Empty>>

// ============================================================================
// Whitespace Handling Tests
// ============================================================================

// Test: Extra spaces are handled
type P_ExtraSpaces = ParseInsertSQL<"INSERT    INTO    users    VALUES    ( 1 )">
type _P21 = RequireTrue<AssertExtends<P_ExtraSpaces, SQLInsertQuery>>

// Test: Newlines are handled
type P_Newlines = ParseInsertSQL<`
INSERT INTO users
( id , name )
VALUES
( 1 , 'John' )
`>
type _P22 = RequireTrue<AssertExtends<P_Newlines, SQLInsertQuery>>

// ============================================================================
// Case Insensitivity Tests
// ============================================================================

// Test: Lowercase keywords
type P_Lowercase = ParseInsertSQL<"insert into users values ( 1 )">
type _P23 = RequireTrue<AssertExtends<P_Lowercase, SQLInsertQuery>>

// Test: Mixed case keywords
type P_MixedCase = ParseInsertSQL<"Insert Into users Values ( 1 )">
type _P24 = RequireTrue<AssertExtends<P_MixedCase, SQLInsertQuery>>

// ============================================================================
// Quoted Identifier Tests
// ============================================================================

// Test: Quoted table name
type P_QuotedTable = ParseInsertSQL<'INSERT INTO "UserAccounts" ( id ) VALUES ( 1 )'>
type P_QuotedTable_Check = P_QuotedTable extends SQLInsertQuery<infer Q>
    ? Q extends InsertClause<TableRef<"UserAccounts", "UserAccounts", undefined>, any, any, any, any>
        ? true
        : false
    : false
type _P25 = RequireTrue<P_QuotedTable_Check>

// Test: Quoted column names
type P_QuotedCols = ParseInsertSQL<'INSERT INTO users ( "firstName" , "lastName" ) VALUES ( \'John\' , \'Doe\' )'>
type P_QuotedCols_Check = P_QuotedCols extends SQLInsertQuery<infer Q>
    ? Q extends InsertClause<any, InsertColumnList<[InsertColumnRef<"firstName">, InsertColumnRef<"lastName">]>, any, any, any>
        ? true
        : false
    : false
type _P26 = RequireTrue<P_QuotedCols_Check>

// ============================================================================
// Export for verification
// ============================================================================

export type InsertParserTestsPass = true

