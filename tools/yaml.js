import {readFile, writeFile} from 'fs/promises';
import yaml from 'yaml';

export async function parse(filePath) {
    const fileContent = await readFile(filePath, {
        encoding: 'utf-8'
    });
    const lines = fileContent.trim().split('\n');
    const yamlLines = [];
    const markdownContentLines = [];
    let yamlStarted = false;
    for (const line of lines) {
        if (line.trim() === '---') {
            if (yamlStarted) {
                yamlStarted = false;
            } else {
                yamlStarted = true;
            }
        } else if (yamlStarted) {
            yamlLines.push(line);
        } else {
            markdownContentLines.push(line);
        }
    }
    const yamlString = yamlLines.join('\n');
    const header = yaml.parse(yamlString);
    const content = markdownContentLines.join('\n');
    return {
        header,
        content
    };
}

export async function stringify(filePath, {header, content}) {
    const yamlString = yaml.stringify(header);
    const updatedContent = `---\n${yamlString}---\n\n${content.trim()}\n`;
    await writeFile(filePath, updatedContent);
}
