import 'reflect-metadata'
import * as mongoose from 'mongoose'
import * as express from 'express'
import { ApolloServer, makeExecutableSchema } from 'apollo-server-express'
import { buildSchema } from 'type-graphql'
import { mergeResolvers, mergeTypeDefs, mergeSchemas } from 'graphql-toolkit'
import { PORT, MONGO_HOST, DB_NAME } from './modules/common/consts'
import UserResolver from './modules/user/UserResolver'
import { authChecker } from './modules/user/authChecker'
import { setUpAccounts, userTypeDefs } from './modules/user/accounts'
import { TypegooseMiddleware } from './middleware/typegoose'

;(async () => {
  const mongooseConnection = await mongoose.connect(
    `mongodb://${MONGO_HOST || 'localhost'}:27017/${DB_NAME}`
  )
  const { accountsGraphQL, accountsServer } = setUpAccounts(mongooseConnection.connection)

  const typeGraphqlSchema = await buildSchema({
    resolvers: [UserResolver],
    globalMiddlewares: [TypegooseMiddleware],
    // scalarsMap: [{ type: ObjectId, scalar: ObjectIdScalar }],
    validate: false,
    emitSchemaFile: true,
    authChecker,
  })

  const schema = makeExecutableSchema({
    typeDefs: mergeTypeDefs([userTypeDefs, accountsGraphQL.typeDefs]),
    resolvers: mergeResolvers([accountsGraphQL.resolvers]),
    schemaDirectives: {
      ...accountsGraphQL.schemaDirectives,
    },
  })

  const server = new ApolloServer({
    schema: mergeSchemas({
      schemas: [schema, typeGraphqlSchema],
    }),
    context: accountsGraphQL.context,
    formatError: error => {
      console.error(error)
      return error
    },
    playground: true,
  })

  const app = express()
  server.applyMiddleware({ app })

  await app.listen({ port: PORT })
  console.log(`🚀 Server ready at localhost:${PORT}`)
})()