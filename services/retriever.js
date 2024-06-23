const { SupabaseVectorStore } = require("@langchain/community/vectorstores/supabase")
const { OpenAIEmbeddings } = require("@langchain/openai")
const { createClient } = require("@supabase/supabase-js")
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY
const SUPABASE_URL_LC_CHATBOT = process.env.SUPABASE_URL_LC_CHATBOT
const client = createClient(SUPABASE_URL_LC_CHATBOT,SUPABASE_API_KEY)
const embeddings = new OpenAIEmbeddings({openAIApiKey:OPENAI_API_KEY})
const vectorStore = new SupabaseVectorStore(embeddings,{
  client,
  tableName:'documents',
  queryName:'match_documents'
})

const retriver=vectorStore.asRetriever({k:2})
module.exports={
    retriver,
}