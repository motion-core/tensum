<script lang="ts">
	import { site } from '$lib/site';

	type PageKind = 'website' | 'article';

	type Props = {
		title: string;
		description: string;
		path: '/' | '/docs';
		kind?: PageKind;
	};

	let { title, description, path, kind = 'website' }: Props = $props();

	const homeUrl = new URL('/', site.origin).href;
	const canonicalUrl = $derived(new URL(path, site.origin).href);
	const socialImageUrl = new URL(site.socialImagePath, site.origin).href;
	const openGraphType = $derived(kind === 'article' ? 'article' : 'website');
	const structuredData = $derived({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebSite',
				'@id': `${homeUrl}#website`,
				url: homeUrl,
				name: site.name,
				description:
					'Analytical spring physics for JavaScript, reactive values, CSS, and GSAP timelines.',
				publisher: {
					'@type': 'Organization',
					name: site.author,
					url: site.organizationUrl
				}
			},
			{
				'@type': 'SoftwareSourceCode',
				'@id': `${homeUrl}#software`,
				name: site.name,
				description,
				url: homeUrl,
				codeRepository: site.repository,
				license: site.licenseUrl,
				programmingLanguage: ['TypeScript', 'JavaScript'],
				runtimePlatform: ['Web browser', 'Node.js']
			},
			...(kind === 'article'
				? [
						{
							'@type': 'TechArticle',
							'@id': `${canonicalUrl}#article`,
							headline: title,
							description,
							url: canonicalUrl,
							isPartOf: { '@id': `${homeUrl}#website` },
							about: { '@id': `${homeUrl}#software` },
							author: {
								'@type': 'Organization',
								name: site.author,
								url: site.organizationUrl
							}
						}
					]
				: [])
		]
	});
	const structuredDataJson = $derived(JSON.stringify(structuredData).replaceAll('<', '\\u003c'));
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="author" content={site.author} />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<link rel="canonical" href={canonicalUrl} />

	<meta property="og:type" content={openGraphType} />
	<meta property="og:site_name" content={site.name} />
	<meta property="og:locale" content="en_US" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={socialImageUrl} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="512" />
	<meta property="og:image:height" content="512" />
	<meta property="og:image:alt" content={site.socialImageAlt} />

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={socialImageUrl} />
	<meta name="twitter:image:alt" content={site.socialImageAlt} />

	<svelte:element this={"script"} type="application/ld+json">{structuredDataJson}</svelte:element>
</svelte:head>
