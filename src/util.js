const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');
let document = null;
let editor = null;
let currentFile = null;
let positions = [];

/**
 * 从某个HTML文件读取能被Webview加载的HTML内容
 * @param {*} context 上下文
 * @param {*} templatePath 相对于插件根目录的html文件相对路径
 */
function getWebViewContent(context, templatePath) {
    const resourcePath = util.getExtensionFileAbsolutePath(context, templatePath);
    const dirPath = path.dirname(resourcePath);
    let html = fs.readFileSync(resourcePath, 'utf-8');
    // vscode不支持直接加载本地资源，需要替换成其专有路径格式，这里只是简单的将样式和JS的路径替换
    html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
        return $1 + vscode.Uri.file(path.resolve(dirPath, $2)).with({
            scheme: 'vscode-resource'
        }).toString() + '"';
    });
    return html;
}

const util = {
    getWebViewContent: getWebViewContent,
    currentFile: currentFile,
    /**
     * 获取当前所在工程根目录，有3种使用方法：<br>
     * getProjectPath(uri) uri 表示工程内某个文件的路径<br>
     * getProjectPath(document) document 表示当前被打开的文件document对象<br>
     * getProjectPath() 会自动从 activeTextEditor 拿document对象，如果没有拿到则报错
     * @param {*} document
     */
    getProjectPath(uri) {
        editor = vscode.window.activeTextEditor;

        if (!uri) {
            document = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : null;
        }
        if (!document) {
            this.showError('当前激活的编辑器不是文件或者没有文件被打开！');
            return '';
        }
        currentFile = (document.uri ? document.uri : document).fsPath;
        util.currentFile = currentFile;
        let projectPath = null;

        let workspaceFolders = vscode.workspace.workspaceFolders.map(item => item.uri.fsPath);

        // 由于存在Multi-root工作区，暂时没有特别好的判断方法，先这样粗暴判断
        // 如果发现只有一个根文件夹，读取其子文件夹作为 workspaceFolders
        if (workspaceFolders.length == 1 && workspaceFolders[0] === vscode.workspace.rootPath) {
            const rootPath = workspaceFolders[0];
            var files = fs.readdirSync(rootPath);
            workspaceFolders = files.filter(name => !/^\./g.test(name)).map(name => path.resolve(rootPath, name));
            // vscode.workspace.rootPath会不准确，且已过时
            // return vscode.workspace.rootPath + '/' + this._getProjectName(vscode, document);
        }
        workspaceFolders.forEach(folder => {
            if (currentFile.indexOf(folder) === 0) {
                projectPath = folder;
            }
        })
        if (!projectPath) {
            this.showError('获取工程根路径异常！');
            return '';
        }
        return projectPath;
    },
    /**
     * 获取当前工程名
     */
    getProjectName: function (projectPath) {
        return path.basename(projectPath);
    },
    /**
     * 获取打开文档内容
     */
    getFileContent() {
        let html = fs.readFileSync(currentFile, 'utf-8');
        return html;
    },
    /**
     * 弹出错误信息
     */
    showError: function (info) {
        vscode.window.showErrorMessage(info);
    },
    /**
     * 弹出提示信息
     */
    showInfo: function (info) {
        vscode.window.showInformationMessage(info);
    },
    /**
     * 获取某个扩展文件绝对路径
     * @param context 上下文
     * @param relativePath 扩展中某个文件相对于根目录的路径，如 images/test.jpg
     */
    getExtensionFileAbsolutePath: function (context, relativePath) {
        return path.join(context.extensionPath, relativePath);
    },
    /**
     * 从某个文件里面查找字符串，返回匹配的行与列，未找到返回第一行第一列
     * @param filePath 要查找的文件
     * @param rules 匹配规则
     *
     */
    findStrInFile: function (filePath, rules) {
        const content = fs.readFileSync(filePath, 'utf-8');
        let pos = [];
        let matches;
        for (let index = 0; index < rules.length; index++) {
            const rows = content.split(os.EOL); // 分行查找只为了拿到行
            let rule = new RegExp(rules[index].find, 'g'); // 正则匹配
            for (let i = 0; i < rows.length; i++) {
                while ((matches = rule.exec(rows[i]))) {
                    pos.push({
                        rule: rules[index].find,
                        to: rules[index].to,
                        row: i,
                        col: rule.lastIndex - matches[0].length
                    });
                }
            }
        }
        console.log(`共查找到${pos.length}个匹配项`, pos);
        return pos || [{
            row: 0,
            col: 0,
            to: '',
            rule: ''
        }];
    },
    /**
     * 选中匹配的字符串
     */
    selectStr: function (filePath, str) {
        positions = this.findStrInFile(filePath, str);
        let selections = [];

        for (let i = 0; i < positions.length; i++) {
            selections.push(
                new vscode.Selection(
                    new vscode.Position(positions[i].row, positions[i].col),
                    new vscode.Position(positions[i].row, positions[i].col + positions[i].rule.length)
                )
            )
            editor.selections = selections;
        }
        return positions.length;
    },
    /**
     * 修改当前激活编辑器内容
     */
    replaceEditorContent: function (filePath, str) {
        editor.edit(editBuilder => {
            // 替换内容
            for (let i = 0; i < positions.length; i++) {
                editBuilder.replace(new vscode.Range(
                    new vscode.Position(positions[i].row, positions[i].col),
                    new vscode.Position(positions[i].row, positions[i].col + positions[i].rule.length)
                ), positions[i].to);
            }
        });
    },
};

module.exports = util;