# Chartsmith Vercel AI SDK Migration - Project Status

## Project Requirements

### Main Objective
Migrate Chartsmith from custom Anthropic SDK implementation to Vercel AI SDK to simplify the codebase and modernize the architecture.

### Success Criteria (Must Have)

1. ✅ **Replace custom chat UI with Vercel AI SDK**
2. ⚠️ **Migrate from direct `@anthropic-ai/sdk` usage to AI SDK Core** (Frontend: ✅, Backend: ❌)
3. ✅ **Maintain all existing chat functionality** (streaming, messages, history)
4. ✅ **Keep existing system prompts and behavior** (user roles, chart context, etc.)
5. ⚠️ **All existing features continue to work** (tool calling, file context, etc.) - Frontend: ✅, Backend: ❌
6. ⚠️ **Tests pass** (or are updated to reflect new implementation) - Status: Unknown

### Nice to Have

1. ✅ **Demonstrate easy provider switching** - OpenRouter support added
2. ✅ **Improve streaming experience** - Using AI SDK optimizations
3. ⚠️ **Simplify state management** - Partially done (useChat hook used, but custom state still present)

### Submission Requirements

1. ❌ **Pull Request** - Not yet created
2. ❌ **Documentation** - Not yet updated
3. ⚠️ **Tests** - Status unknown, may need updates
4. ❌ **Demo Video** - Not yet created

---

## Completed Work ✅

### Frontend (TypeScript/Next.js)

1. **Vercel AI SDK Integration**
   - ✅ Installed `@ai-sdk/anthropic`, `@ai-sdk/react`, and `ai` packages
   - ✅ Implemented `useChat` hook in `ChatContainer.tsx`
   - ✅ Created `/api/chat/route.ts` using `streamText` from Vercel AI SDK
   - ✅ Migrated from direct Anthropic SDK to `createAnthropic` from `@ai-sdk/anthropic`
   - ✅ Added OpenRouter provider support using `@openrouter/ai-sdk-provider`
   - ✅ Implemented provider switching (Anthropic ↔ OpenRouter)

2. **Chat Functionality**
   - ✅ Streaming responses working via Vercel AI SDK
   - ✅ Message history integration with database
   - ✅ System prompts maintained (matching Go backend's `chatOnlySystemPrompt`)
   - ✅ Chat message saving to database on completion
   - ✅ Model selection and provider switching UI

3. **Additional Migrations**
   - ✅ `lib/llm/prompt-type.ts` migrated to use `generateText` from Vercel AI SDK

### Code Quality

- ✅ Clean separation between frontend API routes and backend worker
- ✅ Proper error handling in API routes
- ✅ Session validation maintained
- ✅ Workspace context integration preserved

---

## Remaining Work ❌

### Backend (Go)

1. **Go Backend Still Uses Direct Anthropic SDK**
   - ❌ `pkg/llm/client.go` - Still uses `github.com/anthropics/anthropic-sdk-go`
   - ❌ `pkg/llm/conversational.go` - Direct Anthropic SDK calls
   - ❌ `pkg/llm/execute-action.go` - Direct Anthropic SDK calls
   - ❌ `pkg/llm/execute-plan.go` - Direct Anthropic SDK calls
   - ❌ `pkg/llm/initial-plan.go` - Direct Anthropic SDK calls
   - ❌ `pkg/llm/plan.go` - Direct Anthropic SDK calls
   - ❌ `pkg/llm/expand.go` - Direct Anthropic SDK calls
   - ❌ `pkg/llm/convert-file.go` - Direct Anthropic SDK calls
   - ❌ `pkg/llm/cleanup-converted-values.go` - Direct Anthropic SDK calls
   - ❌ `pkg/llm/summarize.go` - Direct Anthropic SDK calls

   **Note**: The project requirements mention "The existing Go backend will remain, but may need API adjustments." However, the success criteria explicitly states "Migrate from direct `@anthropic-ai/sdk` usage to AI SDK Core" which applies to both frontend and backend.

   **Decision Needed**: 
   - Option A: Migrate Go backend to use Vercel AI SDK Core (if available for Go)
   - Option B: Keep Go backend as-is but ensure it works with the new frontend
   - Option C: Move all LLM calls to Next.js API routes (as partially done with `/api/chat`)

### Frontend Cleanup

1. **Remove Unused Dependencies**
   - ❌ Remove `@anthropic-ai/sdk` from `package.json` (currently unused but still listed)

2. **Simplify ChatContainer Implementation**
   - ⚠️ `ChatContainer.tsx` still has custom fetch implementation alongside `useChat` hook
   - ⚠️ Mixed state management (local state + useChat + Jotai atoms)
   - Consider fully leveraging `useChat` hook's built-in features

### Testing

1. **Test Status**
   - ❌ Run existing tests to verify they pass
   - ❌ Update tests if needed for new implementation
   - ❌ Add new tests for Vercel AI SDK integration

   **Test Files to Check:**
   - `tests/chat-scrolling.spec.ts`
   - `tests/login.spec.ts`
   - `tests/import-artifactory.spec.ts`
   - `tests/upload-chart.spec.ts`

### Documentation

1. **Architecture Documentation**
   - ❌ Update `ARCHITECTURE.md` to reflect Vercel AI SDK integration
   - ❌ Update `chartsmith-app/ARCHITECTURE.md` with AI SDK patterns
   - ❌ Document provider switching mechanism
   - ❌ Document migration decisions and trade-offs

### Submission Artifacts

1. **Pull Request**
   - ❌ Create PR with all changes
   - ❌ Include migration summary
   - ❌ Link to demo video

2. **Demo Video**
   - ❌ Show application starting successfully
   - ❌ Demonstrate creating a new chart via chat
   - ❌ Show streaming responses working
   - ❌ Highlight improvements in implementation
   - ❌ Walk through 1-2 key code changes

---

## Technical Decisions Made

1. **Frontend API Route Approach**: Created `/api/chat/route.ts` in Next.js to handle chat requests using Vercel AI SDK, while maintaining integration with existing workspace system.

2. **Provider Support**: Added OpenRouter provider support alongside Anthropic, demonstrating easy provider switching (Nice to Have requirement).

3. **State Management**: Used `useChat` hook for streaming, but maintained Jotai atoms for workspace/message state to preserve existing architecture.

4. **Backend Integration**: Kept Go backend worker for other LLM operations (planning, execution, etc.) while moving conversational chat to Next.js API route.

---

## Architecture Notes

### Current Architecture

- **Frontend Chat**: Next.js API route (`/api/chat`) using Vercel AI SDK
- **Backend Worker**: Go worker still uses direct Anthropic SDK for:
  - Plan generation
  - Plan execution
  - File conversion
  - Content summarization
  - Prompt expansion

### Recommended Next Steps

1. **Immediate**: Clean up unused `@anthropic-ai/sdk` dependency
2. **High Priority**: Run and fix tests
3. **High Priority**: Update documentation
4. **Medium Priority**: Simplify ChatContainer state management
5. **Decision Required**: Determine approach for Go backend migration (if required)
6. **Final**: Create PR and demo video

---

## Files Modified (Frontend)

- ✅ `chartsmith-app/app/api/chat/route.ts` - New API route using Vercel AI SDK
- ✅ `chartsmith-app/components/ChatContainer.tsx` - Integrated `useChat` hook
- ✅ `chartsmith-app/lib/llm/prompt-type.ts` - Migrated to `generateText`
- ✅ `chartsmith-app/package.json` - Added Vercel AI SDK dependencies

## Files Not Yet Modified (Backend)

- ❌ `pkg/llm/*.go` - All Go LLM files still use direct Anthropic SDK
- ❌ `go.mod` - Still includes `github.com/anthropics/anthropic-sdk-go`

---

## Summary

**Progress: ~60% Complete**

- ✅ Frontend migration: **Complete**
- ❌ Backend migration: **Not started** (decision needed on approach)
- ⚠️ Testing: **Unknown status**
- ❌ Documentation: **Not updated**
- ❌ Submission artifacts: **Not created**

The frontend migration is largely complete and functional. The main remaining work is:
1. Deciding on backend approach
2. Testing and validation
3. Documentation updates
4. Creating submission artifacts

