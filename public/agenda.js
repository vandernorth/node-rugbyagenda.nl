$(document).ready(function () {
    console.log('Ready');
    $('.setTooltip').tooltip({ container: 'body' });

    $('.manualbutton').click(function(){
        $(this).parent().parent().find('.manuallink').toggleClass('hidden');
        $(this).toggleClass('active');
    });
});
