const tsNode = require('ts-node')
const path = require('path')
const configFile = path.join(__dirname, '../tsconfig.json')

tsNode.register({
	project: configFile,
	files: true
})

const { parse, mkSchema } = require('../src/index.ts')

const schema = mkSchema(__dirname, '**/*.gql')

const res = parse(schema, { notNullWhenDefaultValue: false })

debugger