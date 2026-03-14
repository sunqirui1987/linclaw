## Summary

<!-- 简要说明这次 PR 解决了什么问题，为什么要改。 -->


## Scope

- [ ] Frontend
- [ ] Go API / commands
- [ ] Deploy / release / CI
- [ ] Docs
- [ ] Other

## Risk

<!-- 有没有配置迁移、发布流程变更、兼容性风险、用户可见行为变化？ -->


## Validation

- [ ] `npm run build`
- [ ] `go test ./src-go/...`
- [ ] `go build ./src-go/cmd/linclawd`
- [ ] 如果改了发布链，已验证 `npm run release -- linux/amd64`
- [ ] 如果改了部署链，已验证 `bash build.sh` 或 `deploy.sh`
- [ ] 如果改了 UI，已补截图或录屏
- [ ] 如果改了配置/迁移逻辑，已补测试

## Notes

<!-- 其他 reviewer 需要知道的上下文、后续事项、未覆盖项。 -->
