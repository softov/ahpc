# All releases

Every ahpc release, by year. Each page holds a minor release and its patch releases.
Releases before 0.10 have no page: the git tags `v0.3.0` to `v0.9.0` are their record.

<script setup>
import { data } from './releases.data';

const years = [...new Set(data.map((release) => release.date.slice(0, 4)))]
  .map((year) => ({ year, releases: data.filter((release) => release.date.startsWith(year)) }));
</script>

<template v-for="group in years" :key="group.year">
<h2 :id="group.year" tabindex="-1">{{ group.year }} <a class="header-anchor" :href="`#${group.year}`" aria-hidden="true"></a></h2>
<ul>
<li v-for="release in group.releases" :key="release.version"><a :href="`.${release.link.slice('/updates'.length)}`">ahpc {{ release.version }}</a></li>
</ul>
</template>
