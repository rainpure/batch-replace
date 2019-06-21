const testMode = false; // 为true时可以在浏览器打开不报错
// vscode webview 网页和普通网页的唯一区别：多了一个acquireVsCodeApi方法
const vscode = testMode ? {} : acquireVsCodeApi();
const callbacks = {};

/**
 * 调用vscode原生api
 * @param data 可以是类似 {cmd: 'xxx', param1: 'xxx'}，也可以直接是 cmd 字符串
 * @param cb 可选的回调函数
 */
function callVscode(data, cb) {
    if (typeof data === 'string') {
        data = {
            cmd: data
        };
    }
    if (cb) {
        // 时间戳加上5位随机数
        const cbid = Date.now() + '' + Math.round(Math.random() * 100000);
        callbacks[cbid] = cb;
        data.cbid = cbid;
    }
    vscode.postMessage(data);
}

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.cmd) {
        case 'vscodeCallback':
            console.log(message.data);
            (callbacks[message.cbid] || function () {})(message.data);
            delete callbacks[message.cbid];
            break;
        default:
            break;
    }
});

new Vue({
    el: '#app',
    data: {
        size: 'small',
        fileContent: '这里应该是一段html', // 当前激活编辑器内容
        replaceRule: [{
            find: '输入需要替换的内容',
            to: '',
            showDel: false
        }]
    },
    mounted() {
        callVscode('getFileContent', fileContent => this.fileContent = fileContent);
    },
    watch: {},
    methods: {
        // 模拟alert
        alert(info) {
            callVscode({
                cmd: 'alert',
                info: info
            }, null);
        },
        // 弹出错误提示
        error(info) {
            callVscode({
                cmd: 'error',
                info: info
            }, null);
        },
        reset() {
            this.replaceRule.forEach(item => {
                item.find = '';
                item.to = '';
            })
        },
        validate() {
            let emptyNum = 0;
            this.replaceRule.forEach(item => {
                if (!item.find) {
                    emptyNum++;
                }
            });
            if (emptyNum > 0) {
                this.alert('请输入要替换的内容');
                return false;
            }

            return true;
        },
        // 查找匹配项
        match() {
            if (!this.validate()) {
                return;
            }

            callVscode({
                cmd: 'match',
                rules: this.replaceRule
            }, (data) => {
                this.alert(`共查找到${data.length}个匹配项`);
            });
        },
        replace() {
            if (!this.validate()) {
                return;
            }

            callVscode({
                cmd: 'replace',
                rules: this.replaceRule
            }, (data) => {
                this.alert(`${data.length}个匹配项已替换`);
                this.reset();
            });
        },
        add() {
            this.replaceRule.push({
                find: '',
                to: '',
                showDel: false
            })
        },
        del(index) {
            this.replaceRule.splice(index, 1);
        }
    }
});