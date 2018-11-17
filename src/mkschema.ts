import globby from 'globby'
import fs from 'fs'
import path from 'path'
import { makeExecutableSchema, mergeSchemas } from 'graphql-tools'

type GlobbyFunc = typeof globby['sync']
type TOption = Exclude<GlobbyFunc extends (_: any, o: infer R) => any ? R : any, undefined>

/**
 * create a graphql schema user gbob
 * @param dirname search directory
 * @param rootGlobs graphql root files
 * @param fileGlobs other graphql files
 */
export function mkSchema(dirname: string, rootGlobs: string | Array<string>, fileGlobs: string | Array<string>, option?: TOption) {
	option = option || {}
	option.cwd = dirname
	//查询文件
	const roots = globby.sync(rootGlobs, option).map(file => path.join(dirname, file)).filter(file => fs.statSync(file).isFile())
	const files = globby.sync(fileGlobs, option).map(file => path.join(dirname, file)).filter(file => fs.statSync(file).isFile())
	//读取文件内容
	const fileBody = files.map(file => fs.readFileSync(file) + '').join('\n')
	//生成schema
	const schemas = roots.map(root => makeExecutableSchema({ typeDefs: fileBody + '\n' + fs.readFileSync(root) }))
	//合并并返回schema
	return mergeSchemas({ schemas })
}