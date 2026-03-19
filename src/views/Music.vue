<script setup>
    import myLogo from '../assets/logo.png'
    import { ref, onMounted } from 'vue'

</script>
<template>
    <section class="section p1">
        <h1>欢迎来到Zleeper的音乐天空(这么简陋一看就知道还没搞好)</h1>
    </section>
    <section class="section p2">
        <h1>音乐学习进度</h1>
    </section>
</template>
<style scoped>

.section{
    min-height: 100vh;
    width:100%;

    display: flex;
    justify-content: center;
    align-items: center;

    position: relative;
}
.p1{
    background-color: rgb(173, 234, 234);
}
.p2{
    background-color: rgb(172, 230, 235);
}
</style>