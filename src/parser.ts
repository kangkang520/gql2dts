import * as graphql from 'graphql'

export interface IParseOption {
	/** 以哪种方式转换enum类型，可以转换为enum或type，默认type */
	enumType?: 'enum' | 'type'
	/** 以哪种方式转换对象类型，默认interface */
	objectType?: 'interface' | 'type'
	/** 命名空间名称，默认gql */
	namespaceName?: string
	/** 输出类型，export、declare、none，默认declare */
	outputType?: 'export' | 'declare' | 'none'
	/** 是否将参数转换为interface类型，默认false */
	argument2interface?: boolean
	/** 自定义标量类型, 默认为：`{String: 'string', Boolean: 'boolean', Int: 'number', Float: 'number', ID: 'string | number'}` */
	customscalarTypes?: { [P in 'String' | 'Boolean' | 'Int' | 'Float' | 'ID' | string]?: string }
	/** 可以为空的数据类型，默认全部都是：type=>type+' | null | undefined' */
	nullableType?: { [P in 'input' | 'interface' | 'object']?: (type: string) => string }
}

type TNullableTypeFunc = Exclude<IParseOption['nullableType'], undefined>[keyof Exclude<IParseOption['nullableType'], undefined>]

function mkdesc(desc: string | null | undefined) {
	if (!desc) return ''
	return `/** ${desc} */\n`
}

function parseEnum(type: graphql.GraphQLEnumType, enumType: IParseOption['enumType']) {
	if (enumType == 'type') {
		return `${mkdesc(type.description)}export type ${type.name} = ${type.getValues().map(value => `'${value.name}'`).join(' | ')}`
	}
	else {
		const vals = type.getValues().map(value => `${mkdesc(value.description)}${value.name} = '${value.name}'`).join(',\n').replace(/\n/g, '\n\t')
		return `${mkdesc(type.description)}export const enum ${type.name} {\n\t${vals}\n}`
	}
}

//首字母大写
function upperCaseName(name: string) {
	return name[0].toUpperCase() + name.substr(1)
}

//基础类型
function baseTypes(custom: Exclude<IParseOption['customscalarTypes'], undefined>) {
	const gqlKeys = ['String', 'Boolean', 'Int', 'Float', 'ID']
	//处理类型
	if (!custom.String) custom.String = 'string'
	if (!custom.Boolean) custom.Boolean = 'boolean'
	if (!custom.Int) custom.Int = 'number'
	if (!custom.Float) custom.Float = 'number'
	if (!custom.ID) custom.ID = 'string | number'
	//返回类型
	return [
		...Object.keys(custom)
			.map(key => {
				if (gqlKeys.indexOf(key) < 0) return
				return `export type ${key} = ${custom[key as keyof typeof custom]}\n`
			})
			.filter(s => !!s),
		//函数定义
		'interface GQLFunction<P, R> {',
		'	(a: P): R',
		'	args: P',
		'}',
	].join('\n')
}

function parseScalar(type: graphql.GraphQLScalarType, customscalarTypes: IParseOption['customscalarTypes']) {
	const typeName = (customscalarTypes || {})[type.name] || 'any'
	return `${mkdesc(type.description)}export type ${type.name} = ${typeName}`
}

function type2ts(type: graphql.TypeNode, nullableType: TNullableTypeFunc, isNotNull = false): string {
	//此函数用于自动加入空处理
	const addNull = (val: string) => isNotNull ? val : nullableType!(val)
	//分别处理不同类型
	if (type.kind == 'ListType') return addNull(`Array<${type2ts(type.type, nullableType, false)}>`)
	else if (type.kind == 'NonNullType') return `${type2ts(type.type, nullableType, true)}`
	else return addNull(type.name.value)
}

function parseObject(type: graphql.GraphQLObjectType | graphql.GraphQLInterfaceType | graphql.GraphQLInputObjectType, objectType: IParseOption['objectType'], argument2interface: boolean, nullableType: TNullableTypeFunc) {
	const argTypes = [] as Array<string>
	const fields = type.getFields()
	const types = Object.keys(fields).map(key => {
		const desc = fields[key].description || undefined
		const ast = fields[key].astNode
		if (!ast) return null
		//如果有参数则返回函数
		if ((ast.kind == 'FieldDefinition') && ast.arguments && ast.arguments.length) {
			const args = ast.arguments.map(arg => `${arg.name.value}: ${type2ts(arg.type, nullableType)}`)
			if (argument2interface) {
				const interfaceName = `I${upperCaseName(key)}On${upperCaseName(type.name)}Arguments`
				argTypes.push(`interface ${interfaceName} {\n\t${args.join('\n\t')}\n}`)
				return `${mkdesc(desc)}${key}: GQLFunction<${interfaceName}, ${type2ts(ast.type, nullableType)}>`
			}
			else {
				return `${mkdesc(desc)}${key}: GQLFunction<${args.join(', ')} }, ${type2ts(ast.type, nullableType)}>`
			}
		}
		//否则返回类型
		else return `${mkdesc(desc)}${key}: ${type2ts(ast.type, nullableType)}`
	}).filter(t => !!t).map(type => (type || '').replace(/\n/g, '\n\t'))
	//加入节点类型
	if (objectType == 'interface') argTypes.push(`${mkdesc(type.description || undefined)}export interface ${type.name} {\n\t${types.join('\n\t')}\n}`)
	else argTypes.push(`${mkdesc(type.description || undefined)}export type ${type.name} = {\n\t${types.join(',\n\t')}\n}`)
	//返回数据
	return argTypes
}

function parseUnion(type: graphql.GraphQLUnionType) {
	return `${mkdesc(type.description)}export type ${type.name} = ${type.getTypes().map(type => type.name).join(' | ')}`
}

/**
 * 转换一个graphql schema为typescript定义文件
 * @param schema 要转换的schema
 * @param param1 转换选项
 */
export function parse(schema: graphql.GraphQLSchema, {
	enumType = 'type',
	objectType = 'interface',
	namespaceName = 'gql',
	outputType = 'declare',
	argument2interface = true,
	customscalarTypes = {},
	nullableType = {}
}: IParseOption = {}) {
	const defaultNullableType = (type: string) => `${type} | null | undefined`
	const typeMap = schema.getTypeMap()
	const types = [baseTypes(customscalarTypes)]
	//处理数据类型
	Object.keys(typeMap)
		.map(key => typeMap[key])
		.filter(type => type.astNode || ['Query', 'Mutation'].includes(type.name))
		.map(type => {
			//枚举
			if (type instanceof graphql.GraphQLEnumType) return parseEnum(type, enumType)
			//输入类型定义
			else if (type instanceof graphql.GraphQLInputObjectType) return parseObject(type, objectType, argument2interface, nullableType.input || defaultNullableType)
			//接口定义
			else if (type instanceof graphql.GraphQLInterfaceType) return parseObject(type, objectType, argument2interface, nullableType.interface || defaultNullableType)
			//类型定义
			else if (type instanceof graphql.GraphQLObjectType) return parseObject(type, objectType, argument2interface, nullableType.object || defaultNullableType)
			//scalar类型定义，这里不处理，因为在baseTypes中已经处理
			else if (type instanceof graphql.GraphQLScalarType) return parseScalar(type, customscalarTypes)
			//联合类型定义
			else if (type instanceof graphql.GraphQLUnionType) return parseUnion(type)
		})
		.map(type => {
			if (!type) return
			if (type instanceof Array) types.push(...type)
			else types.push(type)
		})
	//生成结果
	return `${(outputType == 'none') ? '' : `${outputType} `}namespace ${namespaceName} {\n\n\t${types.map(type => type.replace(/\r?\n/g, '\n\t')).join('\n\n\t')}\n\n}`
}
