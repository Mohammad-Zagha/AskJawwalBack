var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
const { userModel } = require('../../../DB/model/user.model');

const pdfParse = require("pdf-parse");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const {
  SupabaseVectorStore,
} = require("@langchain/community/vectorstores/supabase");
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const {
  RunnableSequence,
  RunnablePassthrough,
} = require("@langchain/core/runnables");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const {
  standAloneQuestionTemplate,
  answerTemplate,
  nortmalChatTemplate
} = require("../../../services/templates");
const { retriver } = require("../../../services/retriever");
const { createClient } = require("@supabase/supabase-js");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const llm = new ChatOpenAI({ openAIApiKey: OPENAI_API_KEY });
const SUPABASE_API_KEY = process.env.SUPABASE_API_KEY;
const SUPABASE_URL_LC_CHATBOT = process.env.SUPABASE_URL_LC_CHATBOT;
const client = createClient(SUPABASE_URL_LC_CHATBOT, SUPABASE_API_KEY);

const getUserChats = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Find the user by ID
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return the user's chat history
    res.status(200).json({ chatHistory: user.chatHistory });
  } catch (error) {
    console.error('Error fetching user chat history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const combineDocs = (docs) => {
  console.log(docs[0].metadata)
  return docs.map((doc) => `Filename: ${doc.metadata.fileName}\n${doc.pageContent}`).join("\n\n");
};

const formatConvHistory = (messages) => {
  
  return messages.map((message, i) => {

    if (i % 2 === 0) {
      return `Human: ${message}`;
    } else {
      return `AI: ${message}`;
    }
  }).join('\n');
};

const getAiResponse = async (req, res) => {
  const { question, chatHistory, userId,chatTitle } = req.body;

  // Function to format conversation history if needed
  const formattedChatHistory = formatConvHistory(chatHistory);

  const standalonePrompt = PromptTemplate.fromTemplate(standAloneQuestionTemplate);
  const answerPrompt = PromptTemplate.fromTemplate(nortmalChatTemplate);

  const standaloneChain = standalonePrompt.pipe(llm).pipe(new StringOutputParser());
  const retrieverChain = RunnableSequence.from([
    (prevResult) => prevResult.stand_alone,
    retriver,
    combineDocs,
  ]);

  const answerChain = answerPrompt.pipe(llm).pipe(new StringOutputParser());

  const RunnableChain = RunnableSequence.from([
    {
      stand_alone: standaloneChain,
      original_question: new RunnablePassthrough(),
    },
    {
      context: retrieverChain,
      question: ({ original_question }) => original_question.question,
      chat_History: ({ original_question }) => original_question.chat_History,
    },
    answerChain,
  ]);

  try {
    // Invoke the AI model to get response
    const response = await RunnableChain.invoke({ question, chat_History: formattedChatHistory });

    // If userId is defined, handle database operations
    if (userId) {
      // Check if user exists in database
      const user = await userModel.findById(userId);

      if (user) {
        // User exists, update or create chat history
        const existingChat = user.chatHistory.find(chat => chat.chatTitle === chatTitle);

        if (existingChat) {
          // Append messages to existing chat history
          existingChat.messages.push(question);
          existingChat.messages.push(response);
        } else {
          console.log("here")
          user.chatHistory.push({
            chatTitle: chatTitle, // Replace with appropriate chat title logic
            messages: [question,response],
          });
        }


        // Save the updated user document
        await user.save();
      } else {
        // Handle case where user is not found (optional)
      }
    }

    // Return the AI response to the client
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching AI response:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const uploadPdfs = async (req, res) => {
  if (!req.files) {
    return res.status(400).send({ message: "No files uploaded" });
  }

  try {
    let documents = [];

    await Promise.all(
      req.files.map(async (file) => {
        const data = await pdfParse(file.buffer);
        const text = data.text;

        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 250,
          separators: ["\n\n", "\n", ""],
          chunkOverlap: 30,
        });

        const chunks = await splitter.createDocuments([text]);

        chunks.forEach(chunk => {
          chunk.metadata = { fileName: file.originalname };
        });

        documents = documents.concat(chunks);
      })
    );

    await SupabaseVectorStore.fromDocuments(
      documents,
      new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY }),
      {
        client,
        tableName: "documents",
      }
    );

    res.status(200).send("Files processed. What would you like to know?");
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Error processing PDF files",
      error: error.message,
    });
  }
};

const signup = async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const user = await userModel.findOne({ phoneNumber });
    if (user) {
      return res.json({ message: "Number already registered" });
    } else {
   
      const newUser = new userModel({ phoneNumber });
      const savedUser = await newUser.save();
      res.json({ message: "User registered successfully", savedUser });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const signin = async (req, res) => {
  const { phoneNumber} = req.body;
  console.log(phoneNumber)
  try {
    const user = await userModel.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).json({ message: "Email not found" });
    }

    const token = jwt.sign({ id: user._id }, process.env.TokenSignature);
    res.status(200).json({ message: "Logged in successfully", user:user._id, phoneNumber: user.phoneNumber });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getAiResponseWithoutPdf = async (req, res) => {
  const { question } = req.body;

  const answerPrompt = PromptTemplate.fromTemplate(answerTemplate);

  const answerChain = answerPrompt.pipe(llm).pipe(new StringOutputParser());

  const response = await answerChain.invoke({ question: question });
  res.status(200).json(response);
}

module.exports = {getUserChats, uploadPdfs, getAiResponse, signup, signin, getAiResponseWithoutPdf };
