const vscode = require("vscode");
const fetch = require("node-fetch");
const { exec } = require("child_process");

function getGitDiff() {
  return new Promise((resolve, reject) => {
    exec("git diff --cached", { cwd: vscode.workspace.rootPath }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

async function generateCommitMessage(diff) {
  const config = vscode.workspace.getConfiguration("commitMsgGen");
  const apiKey = config.get("apiKey");
  const baseUrl = config.get("baseUrl");
  const model = config.get("model");
  const maxTokens = config.get("maxTokens");

  if (!apiKey) {
    vscode.window.showErrorMessage("API key not set in settings.");
    return null;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: "You are an AI that writes clear, concise Git commit messages." },
        { role: "user", content: `Generate a short commit message for the following git diff:\n\n${diff}` }
      ],
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content.trim();
}

async function insertCommitMessage(message) {
  const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
  const api = gitExtension?.getAPI(1);

  if (!api || api.repositories.length === 0) {
    vscode.window.showErrorMessage("No Git repository found.");
    return;
  }

  // Set the commit message in the real Git SCM input box
  api.repositories[0].inputBox.value = message;
}

function activate(context) {
  let disposable = vscode.commands.registerCommand("extension.generateCommitMessage", async function () {
    try {
      const diff = await getGitDiff();
      if (!diff) {
        vscode.window.showErrorMessage("No staged changes found.");
        return;
      }

      const commitMessage = await generateCommitMessage(diff);
      if (commitMessage) {
        await insertCommitMessage(commitMessage);
        vscode.window.showInformationMessage("Commit message generated!");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
