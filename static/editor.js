
(function () {
    const vscode = acquireVsCodeApi();

    vscode.postMessage('markdown:ready');
})();


window.addEventListener('message', e => {
    switch (e.data.id) {
        case 'markdown:contents':
            buildEditor(e.data.value);
            break;
    }
});

function buildEditor(value) {
    try {
        const instance = new tui.Editor({
            el: document.querySelector('#editorSection'),
            initialEditType: 'wysiwyg',
            previewStyle: 'tab',
            height: 'auto',
            hideModeSwitch: true,
            initialValue: value
        });

        instance.getHtml();
    } catch (error) {
        console.error(error);
    }
}

