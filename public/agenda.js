$(document).ready(function () {
    console.log('Ready');
    $('.setTooltip').tooltip({ container: 'body' });

    $('.manualbutton').click(function(){
        $(this).parent().parent().find('.manuallink').toggleClass('hidden');
        $(this).toggleClass('active');
    });
});

//== Google Analytics
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
        (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-21880515-4', 'auto');
ga('send', 'pageview');