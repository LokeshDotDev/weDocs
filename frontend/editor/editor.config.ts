import DecoupledEditor from '@ckeditor/ckeditor5-build-decoupled-document';

DecoupledEditor.defaultConfig = {
    toolbar: {
        items: [
            'heading',
            '|',
            'bold',
            'italic',
            'underline',
            'alignment',
            '|',
            'bulletedList',
            'numberedList',
            'outdent',
            'indent',
            '|',
            'blockQuote',
            'insertTable',
            'tableColumn',
            'tableRow',
            'mergeTableCells',
            '|',
            'undo',
            'redo',
            'findAndReplace',
            'horizontalLine',
            'pageBreak',
            'wordCount'
        ]
    },
    language: 'en',
    table: {
        contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
    }
};

export default DecoupledEditor;