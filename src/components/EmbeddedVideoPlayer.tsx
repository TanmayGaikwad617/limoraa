import React, { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { theme } from '../theme';

type EmbedProvider = 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'unknown';

type EmbeddedVideoPlayerProps = {
  platform: string;
  sourceUrl: string;
  embedUrl?: string | null;
  embedHtml?: string | null;
  title?: string | null;
  onError?: () => void;
};

const MOBILE_USER_AGENT = Platform.select({
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  default:
    'Mozilla/5.0 (Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function getProvider(platform: string, url?: string | null): EmbedProvider {
  const text = `${platform} ${url ?? ''}`.toLowerCase();

  if (text.includes('youtube') || text.includes('youtu.be')) return 'youtube';
  if (text.includes('instagram')) return 'instagram';
  if (text.includes('tiktok')) return 'tiktok';
  if (text.includes('twitter') || text.includes('x.com')) return 'twitter';

  return 'unknown';
}

function normalizeHttpsUrl(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function extractYouTubeVideoId(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^m\./, '').replace(/^www\./, '');

    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (host.endsWith('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) {
        return url.pathname.split('/').filter(Boolean)[1] ?? null;
      }

      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/').filter(Boolean)[1] ?? null;
      }

      if (url.pathname.startsWith('/live/')) {
        return url.pathname.split('/').filter(Boolean)[1] ?? null;
      }

      if (url.pathname === '/watch') {
        return url.searchParams.get('v');
      }
    }
  } catch {
    return value.trim() || null;
  }

  return null;
}

function extractInstagramShortcode(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const segments = url.pathname.split('/').filter(Boolean);
    const reelIndex = segments.indexOf('reel');
    const postIndex = segments.indexOf('p');

    if (reelIndex >= 0) return segments[reelIndex + 1] ?? null;
    if (postIndex >= 0) return segments[postIndex + 1] ?? null;
  } catch {
    return null;
  }

  return null;
}

function extractTikTokVideoId(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const segments = url.pathname.split('/').filter(Boolean);
    const videoIndex = segments.indexOf('video');
    return videoIndex >= 0 ? segments[videoIndex + 1] ?? null : null;
  } catch {
    return null;
  }
}

function extractTweetId(value?: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const segments = url.pathname.split('/').filter(Boolean);
    const statusIndex = segments.indexOf('status');
    return statusIndex >= 0 ? segments[statusIndex + 1] ?? null : null;
  } catch {
    return null;
  }
}

function buildEmbedUrl(provider: EmbedProvider, sourceUrl: string, embedUrl?: string | null): string | null {
  const safeEmbedUrl = normalizeHttpsUrl(embedUrl);
  if (safeEmbedUrl) {
    if (provider === 'youtube') {
      const url = new URL(safeEmbedUrl);
      url.hostname = 'www.youtube-nocookie.com';
      url.searchParams.set('playsinline', '1');
      url.searchParams.set('rel', '0');
      url.searchParams.set('modestbranding', '1');
      url.searchParams.set('enablejsapi', '1');
      return url.toString();
    }

    return safeEmbedUrl;
  }

  if (provider === 'youtube') {
    const videoId = extractYouTubeVideoId(sourceUrl);
    return videoId
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1`
      : null;
  }

  if (provider === 'instagram') {
    const shortcode = extractInstagramShortcode(sourceUrl);
    return shortcode
      ? `https://www.instagram.com/reel/${encodeURIComponent(shortcode)}/embed/`
      : null;
  }

  if (provider === 'tiktok') {
    const videoId = extractTikTokVideoId(sourceUrl);
    return videoId ? `https://www.tiktok.com/embed/v2/${encodeURIComponent(videoId)}` : null;
  }

  if (provider === 'twitter') {
    const tweetId = extractTweetId(sourceUrl);
    return tweetId ? `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(tweetId)}` : null;
  }

  return null;
}

function buildProviderBody(
  provider: EmbedProvider,
  sourceUrl: string,
  embedUrl: string | null,
  embedHtml?: string | null,
  title?: string | null,
): string | null {
  if (provider !== 'youtube' && embedHtml?.trim()) {
    return embedHtml;
  }

  if (provider === 'twitter') {
    const tweetUrl = normalizeHttpsUrl(sourceUrl);
    if (!tweetUrl) return null;

    return `<blockquote class="twitter-tweet"><a href="${escapeHtml(tweetUrl)}"></a></blockquote>`;
  }

  if (!embedUrl) return null;

  const safeSrc = escapeHtml(embedUrl);
  const safeTitle = escapeHtml(title?.trim() || 'Embedded video');
  const allow =
    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

  const iframeId = provider === 'youtube' ? ' id="youtube-player"' : '';

  return `<iframe${iframeId} src="${safeSrc}" title="${safeTitle}" allow="${allow}" allowfullscreen></iframe>`;
}

function buildHtml(provider: EmbedProvider, body: string): string {
  const scripts = [
    provider === 'instagram'
      ? '<script async src="https://www.instagram.com/embed.js"></script>'
      : '',
    provider === 'twitter'
      ? '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>'
      : '',
    provider === 'tiktok'
      ? '<script async src="https://www.tiktok.com/embed.js"></script>'
      : '',
  ].join('\n');
  const playerErrorScript = provider === 'youtube'
    ? `
    <script>
      (function () {
        var hasReported = false;
        function reportPlayerError(code) {
          if (hasReported) return;
          hasReported = true;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'player_error',
              provider: 'youtube',
              code: code == null ? null : code
            }));
          }
        }
        window.onYouTubeIframeAPIReady = function () {
          try {
            new YT.Player('youtube-player', {
              events: {
                onError: function (event) {
                  reportPlayerError(event && event.data);
                }
              }
            });
          } catch (error) {}
        };
        window.addEventListener('message', function (event) {
          try {
            var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data && data.event === 'onError') {
              reportPlayerError(data.info);
            }
          } catch (error) {}
        });
        var tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      })();
    </script>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
    />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        min-height: 100%;
        background: #000;
        color: #fff;
        overflow: hidden;
      }

      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .embed-root {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      iframe,
      video {
        width: 100% !important;
        height: 100% !important;
        border: 0;
        display: block;
      }

      blockquote {
        margin: 0 !important;
      }

      .instagram-media,
      .twitter-tweet,
      .tiktok-embed {
        min-width: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
      }
    </style>
  </head>
  <body>
    <main class="embed-root ${provider}">
      ${body}
    </main>
    ${scripts}
    ${playerErrorScript}
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () {
          if (window.instgrm && window.instgrm.Embeds) {
            window.instgrm.Embeds.process();
          }
          if (window.twttr && window.twttr.widgets) {
            window.twttr.widgets.load();
          }
        }, 250);
      });
    </script>
  </body>
</html>`;
}

export function isEmbeddablePlatform(platform: string, sourceUrl?: string | null): boolean {
  return getProvider(platform, sourceUrl) !== 'unknown';
}

export function EmbeddedVideoPlayer({
  platform,
  sourceUrl,
  embedUrl,
  embedHtml,
  title,
  onError,
}: EmbeddedVideoPlayerProps) {
  const source = useMemo(() => {
    const provider = getProvider(platform, sourceUrl);
    const providerEmbedUrl = buildEmbedUrl(provider, sourceUrl, embedUrl);
    const body = buildProviderBody(provider, sourceUrl, providerEmbedUrl, embedHtml, title);

    if (body) {
      return {
        html: buildHtml(provider, body),
        baseUrl: providerEmbedUrl ?? normalizeHttpsUrl(sourceUrl) ?? 'https://contentcategorize.app',
      };
    }

    const safeSourceUrl = normalizeHttpsUrl(sourceUrl);
    return safeSourceUrl ? { uri: safeSourceUrl } : null;
  }, [embedHtml, embedUrl, platform, sourceUrl, title]);

  if (!source) return null;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { type?: string };
      if (payload.type === 'player_error') {
        onError?.();
      }
    } catch {
      // Ignore provider scripts that post non-JSON messages.
    }
  };

  return (
    <WebView
      source={source}
      style={styles.webview}
      originWhitelist={['https://*']}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      mixedContentMode="always"
      setSupportMultipleWindows={false}
      userAgent={MOBILE_USER_AGENT}
      startInLoadingState
      androidLayerType="hardware"
      onError={onError}
      onMessage={handleMessage}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: theme.colors.cardSoft,
  },
});
