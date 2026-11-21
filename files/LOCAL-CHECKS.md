# Local checks

Product commit `f826abfa9a9cb4a30eaedd3ab9b219aac31aaa21`. Local verification used Node 22.20.0 and pnpm 10.12.4.

## Release metadata and parity

```text
Release metadata: versions, previousVersion, rer pin, migrations, contract changes and screenshot passed.
Changelog parity: CHANGELOG.md, RELEASE.md, and RELEASE.json match exactly.
Pinned rer release source and public notes validation passed for v0.7.17 at f826abfa9a9cb4a30eaedd3ab9b219aac31aaa21.
```

The pinned rer release module validated the clean committed source and the annotated release notes string. This ran the metadata validator without building or producing release artifacts.

## Typecheck

```text
> tsc --noEmit
```

Exit 0.

## Generated contracts

```text
Contract prose: 0 errors, 0 warnings.
Contract documents are current.
```

## Source lock

```text
  "ok": true,
      "sha256": "ad3d608e5f55a8f8e574b1ab352481e9c29b70b8d389a49a54b25db2b306497f",
      "executable": false
    }
  }
}
```

The documented lock command was the final regeneration step. The source lock check exited 0.

## Declared file hashes from the remote-advertised head

```text
setup.sha256 path=rer-setup.json declared=f6edca8868764a1a476d8635c06d7b40e4fcbe293c6dc5d1c9ae40de969ea256 actual=f6edca8868764a1a476d8635c06d7b40e4fcbe293c6dc5d1c9ae40de969ea256 match=true
```

The project manifest has one declaration about a checkout file. No hash correction was needed.

## Candidate integrity

```text
Staged additions: credential-pattern check passed.
Candidate identities and trailers passed
PUSH_OK branch=cloud/sd-spool-release-0-7-17
```

`git diff --check` passed. The product commit had fleet author and committer identities and no commit trailers. `CONTRACT.md` and both generated views match the previous tag and main.

## First-party project check

```text
> rer check -- --profile first-party
WARNING: Proxy environment variables detected. We'll use your proxy for fetch requests.
```

Exit 0. The checkout remained clean.

## Targeted follow-up for the CI failure

`pnpm run build:app` exited 0. With the built application, Node 22.20.0 and system Chromium using the test harness's sandbox flag, `pnpm test:runtime` exited 0.

```text
PROBE SDK-020 G5: anonymous docs navigation, seven configuration sections, source maps, Python guidance, tunnel replacement and generated static article passed.
Settings prerequisite guides passed: Slack and cron reach pinned Base owner steps and a working receipt-to-binding recipe; Business trust links open locally and anonymously from the docs index.
Spool runtime: DB health, server document gate, direct API gate, local owner admission, second-claim refusal and immediate revocation passed.
```

The checkout remained clean.
