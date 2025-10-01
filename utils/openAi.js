import dotenv from "dotenv";
dotenv.config({
  silent: true,
});
import Mode from "../models/mode.model.js";
import OpenAI from "openai";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const useOpenAiLib = () => {
  const createResponse = async (input) => {
    const OPENAI_API_KEY = await (async () => {
      const mode = await Mode.find({});
      return mode.length > 0
        ? mode[0].mode === "dev"
          ? process.env.OPENAI_API_KEY_MODE_DEV
          : process.env.OPENAI_API_KEY_MODE_PROD
        : process.env.OPENAI_API_KEY_MODE_DEV;
    })();
    await delay(2000);
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    return new Promise((resolve, rej) => {
      openai.responses
        .create({
          model: "gpt-4.1-mini-2025-04-14",
          temperature: 0.7,
          top_p: 0.9,
          stream: false,
          input: input,
        })
        .then((result) => {
          resolve(result.output[0].content[0].text);
        });
    });
  };

  return {
    createResponse,
  };
};
export default useOpenAiLib;
