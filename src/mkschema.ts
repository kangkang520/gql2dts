import globby from 'globby'
import fs from 'fs'
import path from 'path'
import { makeExecutableSchema } from 'graphql-tools'
import { mergeTypes } from 'merge-graphql-schemas'

type GlobbyFunc = typeof globby['sync']
type TOption = Exclude<GlobbyFunc extends (_: any, o: infer R) => any ? R : any, undefined>

/**
 * create a graphql schema user gbob
 * @param searchDir search directory
 * @param globs graphql root files
 * @param fileGlobs other graphql files
 */
export function mkSchema(searchDir: string, globs: string | Array<string>, option?: TOption) {
	option = option || {}
	option.cwd = searchDir
	//查询文件
	const files = globby.sync(globs, option).map(file => path.join(searchDir, file)).filter(file => fs.statSync(file).isFile())
	//合并为一个graphql文件
	const types = files.map(file => fs.readFileSync(file) + '')
	const typeDefs = mergeTypes(types, { all: true })
	//生成schema
	return makeExecutableSchema({ typeDefs, resolverValidationOptions: { requireResolversForResolveType: false } })
}