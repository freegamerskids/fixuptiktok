import { HTML_EMBED_TEMPLATE } from './strings';

const botRegex = /(discordbot|telegrambot|facebook|whatsapp|firefox\/92|vkshare|revoltchat|preview)/gi;

export interface Env {}

interface IUser{
	id: string;
	username: string;
	nickname: string;
	avatar: string;
}

interface IMusic {
	id: string;
	title: string;
	creatorName: string;
	playUrl: string;
}

interface IVideoSource {
	thumbnail: string;
	playUrl: string;
}

interface IVideo {
	id: string;
	description: string;
	likeCount: number;
	commentCount: number;
	shareCount: number;
	views: number;
	user: IUser;
	music: IMusic;
	videoSource: IVideoSource;
}

async function getVideoInfo(url: string) {
	const req = await fetch("https://www.tikwm.com/api/", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ url , count: "12" , cursor: "0" , web: "1", hd: "1"}).toString()
	});

	if (!req.ok) {
		throw new Error(
		  "There was an Error retrieveing this video without watermark!"
		);
	}
	const noWaterJson: any = await req.json();
	if (noWaterJson.code === -1) {
		throw new Error(
		  "API Limit for nowatermark, please wait 1 second and try again!"
		);
	}
  
	return noWaterJson;
}

function getTikwmUrl(path: string): string {
	return "https://www.tikwm.com" + path;
}

async function getVideo(url: URL, ctx:ExecutionContext): Promise<IVideo> {
	const { pathname } = url;

	const cache = caches.default;

	let cachedResponse = await cache.match(new Request(url.toString()));
	if (cachedResponse) {
		console.log("Cache hit");
        return cachedResponse.json();
    }

	console.log("Cache miss");

	let video = (await getVideoInfo(`https://tiktok.com${pathname}`)).data;

	let videoApi: IVideo = {
		id: video.id,
        description: video.title,
        likeCount: video.digg_count,
        commentCount: video.comment_count,
        shareCount: video.share_count,
        views: video.play_count,
        user: {
            id: video.author.id,
            username: video.author.unique_id,
            nickname: video.author.nickname,
            avatar: getTikwmUrl(video.author.avatar)
        },
        music: {
            id: video.music_info.id,
            title: video.music_info.title,
            creatorName: video.music_info.author,
			playUrl: getTikwmUrl(video.music)
        },
		videoSource: {
            thumbnail: getTikwmUrl(video.cover),
            playUrl: getTikwmUrl(video.hdplay)
		}
	};

	ctx.waitUntil(cache.put(new Request(url.toString()), new Response(JSON.stringify(videoApi))));

	return videoApi;
}

function owoembed(url: URL):string {
	const { searchParams } = url;
	return JSON.stringify({
		"author_name": searchParams.get('text'),
        "author_url": searchParams.get('url'),
        "provider_name": "FixUpTiktok",
        "provider_url": "https://github.com/freegamerskids/fixuptiktok",
        "title": "TikTok",
        "type": "link",
        "version": "1.0"
	});
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const isApiRequest = request.url.includes("/api/");
		const url = new URL(request.url.replace('/api/','/'));
		const { pathname, hostname } = url;

		if (pathname === "/owoembed") return new Response(owoembed(url), { headers: { 'Content-Type': 'application/json' } });
		if (!pathname.match(/\/@.*\/video\/\d*/gm)) return Response.redirect('https://github.com/freegamerskids/fixuptiktok', 301);

		if (!request.headers?.get("User-Agent")?.match(botRegex) && !isApiRequest) return Response.redirect(`https://tiktok.com${pathname}`, 301);

		let videoApi: IVideo = await getVideo(url, ctx);
		if (isApiRequest) return new Response(JSON.stringify(videoApi), { headers: { 'Content-Type': 'application/json' } });

		const stats = `${videoApi.likeCount} ❤️ ${videoApi.commentCount} 💬 ${videoApi.shareCount} 🔁 ${videoApi.views} 👁️`;

		const metaTags = [
			`<meta content='text/html; charset=UTF-8' http-equiv='Content-Type' />`,
			`<meta name="theme-color" content="#8100AB"/>`,
			`<meta property="og:site_name" content="FixUpTiktok" />`,

			`<meta name="twitter:card" content="player" />`,
			`<meta name="twitter:title" content="${videoApi.user.nickname} (@${videoApi.user.username})" />`,
			`<meta name="twitter:image" content="${videoApi.videoSource.thumbnail}" />`,
			`<meta name="twitter:player:stream" content="${videoApi.videoSource.playUrl}" />`,
			`<meta name="twitter:player:stream:content_type" content="video/mp4" />`,

			`<meta property="og:title" content="${videoApi.user.nickname} (@${videoApi.user.username})"/>`,
			`<meta property="og:type" content="video.other"/>`,
			`<meta property="og:video" content="${videoApi.videoSource.playUrl}"/>`,
			`<meta property="og:video:secure_url" content="${videoApi.videoSource.playUrl}"/>`,
			`<meta property="og:video:type" content="video/mp4"/>`,
			`<meta property="og:image" content="${videoApi.videoSource.thumbnail}"/>`,

			`<meta property="og:description" content="${videoApi.description}"/>`,

			`<link rel="alternate" href="https://${hostname}/owoembed?text=${stats}&url=https://titkok.com${pathname}" type="application/json+oembed" title="${videoApi.user.nickname}">`,
			`<meta http-equiv="refresh" content="0; url = https://titkok.com${pathname}" />`
		]

		return new Response(HTML_EMBED_TEMPLATE.replace("{}", metaTags.join("\n")), { headers: { 'Content-Type': 'text/html' } })
	},
};
