# gql2dts

A tool to parse graphql schema to typescript defs.

## Installation
```
npm install gql2dts
```

## Usage
```typescript
import gql2dts from 'gql2dts'
import fs from 'fs'

const dts = gql2dts.parse(graphqlSchema, option)
fs.writeFileSync('/path/to/gql.d.ts', dts)
```

## Options

using option argument, you can set your code style.

now, there is a graphql file like:
```graphql
enum Gender{
	male
	female
	unknown
}
type User{
	id: ID!
	name: String!
	gender: Gender
}
type Query{
	user(id:ID!): User
	users: [User!]!
}
```

### enumType

tell parser program how to parse graphql enum type, default 'type'.

when `enum`
```typescript
const enum Gender {
	male = 'male',
	female = 'female'
	unknown = 'unknown'
}
```
when `type`
```typescript
type Gender = 'male' | 'female' | 'unknown'
```

### objectType
tell parser how to parse graphql object type, default 'interface'.

when `interface`:
```typescript
interface User {
	id: ID
	name: String
	gender: Gender | null | undefined
}
```
when `type`
```typescript
type User = {
	id: ID
	name: String
	gender: Gender | null | undefined
}
```

### namespaceName

set namespace name of ts defs, default 'gql'
```typescript
namespace gql{
	//... ...
}
```

### outputType
eh, this is only a string before namespace
```typescript
//when 'declare'
declare namespace gql{}
//when 'export'
export namespace gql{}
//when 'none'
namespace gql{}
```

### argument2interface

to parse argument to interface ?

when true
```typescript
interface IUserOnQueryArguments {
	id: ID
}
interface Query {
	user:GQLFunction<IUserOnQueryArguments, User|null|undefined>
	users: Array<User>
}
```
and when false
```typescript
interface Query {
	user:GQLFunction<{ id: ID }, User|null|undefined>
	users: Array<User>
}
```

### customscalarTypes

set types for graphql scalar types, such as:
```typescript
{Int: 'number', String:'string', ... ...}
```

### nullableType

when get nullable type, how to parse it?
```typescript
// {object: type=>type+' | null' }
interface User {
	id: ID
	name: String
	gender: Gender | null
}
// {object: type=>type }
interface User {
	id: ID
	name: String
	gender: Gender
}
```