const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(file, modules = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  }).outputText, { exports, require:name => modules[name] ?? require(name), Uint8Array, AbortController,
    Date, setTimeout,clearTimeout,console,TextEncoder });
  return exports;
}
const credentials = load('src/features/app-lock/credentials.ts');

test('follow actions share optimistic state, block double taps, reconcile success and roll back failed/offline writes', async () => {
  const relations=load('src/features/requests/relationship.ts');
  const runtime={sessionIdentity:{generation:1}};
  const cache=new Map(), tasks=[];
  const key=JSON.stringify(relations.relationshipKey('peer'));
  cache.set(key,{status:'none'});
  const client={getQueryData:k=>cache.get(JSON.stringify(k)),setQueryData:(k,v)=>cache.set(JSON.stringify(k),v),cancelQueries:async()=>{},invalidateQueries:async()=>{}};
  let finish, calls=0, failures=0;
  const {useFollowUser}=load('src/features/requests/hooks/useRequests.ts',{
    '@tanstack/react-query':{
      useQueryClient:()=>client,useQuery:opts=>({data:client.getQueryData(opts.queryKey),isPending:false,isError:false}),useMutationState:()=>[],
      useMutation:opts=>({mutate:value=>{
        tasks.push((async()=>{
          let context;
          try {context=await opts.onMutate(value);const data=await opts.mutationFn(value);await opts.onSuccess(data,value,context);}
          catch(error){await opts.onError(error,value,context);}
          finally {await opts.onSettled(undefined,undefined,value,context);}
        })());
      }}),
    },
    'expo-haptics':{},'expo-router':{useRouter:()=>({})},
    '@/components/ui/Toast':{toast:{error:()=>failures++}},'@/services/errors':{describeError:()=> 'offline'},
    '@/services/queryKeys':{queryKeys:{requests:['requests'],feed:['feed'],conversations:['chat'],notifications:['notifications']}},
    '../services':{},'../services/requestsService.real':{
      followUser:()=>{calls++;return new Promise(resolve=>{finish=resolve;});},
      unfollowUser:async()=>{throw new Error('offline');},
    },
    '@/services/api/backend':{},'../relationship':relations,'../requestCache':load('src/features/requests/requestCache.ts'),
    '@/features/auth/store/authStore':{useAuthStore:{getState:()=>({refreshProfile:async()=>{}})}},
    '@/features/auth/sessionRuntime':runtime,
  });
  const first=useFollowUser('peer'), second=useFollowUser('peer');
  first.follow();second.follow();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1); assert.equal(cache.get(key).status,'requested');
  finish({_id:'request',status:'accepted'});await Promise.all(tasks);
  assert.equal(cache.get(key).status,'following');
  useFollowUser('peer').remove();await Promise.all(tasks);
  assert.equal(cache.get(key).status,'following');assert.equal(failures,1);
  useFollowUser('peer').follow();await new Promise(resolve=>setImmediate(resolve));
  runtime.sessionIdentity.generation++;cache.clear();finish({_id:'late',status:'accepted'});await Promise.all(tasks);
  assert.equal(cache.has(key),false,'late mutation cannot restore data after logout');
  first.follow();await Promise.all(tasks);
  assert.equal(calls,2,'a stale screen handler must not submit as the next account');
  assert.equal(cache.has(key),false,'a stale handler must not optimistically overwrite the next account');
});

test('request actions restore only the failed row, deduplicate actions and isolate late completions after logout', async () => {
  const runtime={sessionIdentity:{generation:1}};
  const cache=new Map(), invalidations=[], calls=[], notices=[], routes=[];
  const key=['requests'];
  const client={
    getQueryData:k=>cache.get(JSON.stringify(k)),
    setQueryData:(k,value)=>{const id=JSON.stringify(k);const next=typeof value==='function'?value(cache.get(id)):value;if(next!==undefined)cache.set(id,next);},
    cancelQueries:async()=>{},invalidateQueries:async({queryKey})=>invalidations.push(queryKey),
  };
  const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
  const pending=new Map();
  const operation=(action,id)=>{calls.push([action,id]);const task=deferred();pending.set(id,task);return task.promise;};
  const {useRequestActions}=load('src/features/requests/hooks/useRequests.ts',{
    '@tanstack/react-query':{useQueryClient:()=>client,useMutation:opts=>{
      const mutation={isPending:false};
      mutation.mutateAsync=async(value)=>{
        mutation.isPending=true;mutation.variables=value;let context,data,error;
        try {context=await opts.onMutate(value);data=await opts.mutationFn(value);await opts.onSuccess?.(data,value,context);return data;}
        catch(failure){error=failure;await opts.onError?.(failure,value,context);throw failure;}
        finally {await opts.onSettled?.(data,error,value,context);mutation.isPending=false;}
      };return mutation;
    }},
    'expo-haptics':{NotificationFeedbackType:{Success:1},notificationAsync:async()=>{}},
    'expo-router':{useRouter:()=>({push:route=>routes.push(route)})},
    '@/components/ui/Toast':{toast:{error:message=>notices.push({error:message}),show:message=>notices.push({message}),success:(message,action)=>notices.push({message,action})}},
    '@/services/errors':{describeError:()=> 'offline'},
    '@/services/queryKeys':{queryKeys:{requests:key,feed:['feed'],conversations:['chat'],notifications:['notifications']}},
    '../services':{requestsService:{accept:id=>operation('accept',id),decline:id=>operation('decline',id),cancel:id=>operation('cancel',id)}},
    '../services/requestsService.real':{},'@/services/api/backend':{},
    '../relationship':load('src/features/requests/relationship.ts'),
    '../requestCache':load('src/features/requests/requestCache.ts'),
    '@/features/auth/sessionRuntime':runtime,
  });
  const request=id=>({id,user:{id:'peer-'+id,name:id},direction:'incoming'});
  const a=request('a'), b=request('b');
  cache.set(JSON.stringify(key),{incoming:[a,b],outgoing:[]});
  const actions=useRequestActions(), second=useRequestActions();
  const accepted=actions.accept.mutateAsync(a);
  const declined=actions.decline.mutateAsync(b);
  const rejected=assert.rejects(declined,/offline/);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(cache.get(JSON.stringify(key)).incoming.length,0);
  await assert.rejects(second.cancel.mutateAsync(a),/unavailable/);
  assert.equal(calls.length,2,'duplicate actions across hook instances must not call the API');
  pending.get('a').resolve({conversationId:'user:peer-a'});await accepted;
  pending.get('b').reject(new Error('offline'));await rejected;
  assert.deepEqual(Array.from(cache.get(JSON.stringify(key)).incoming,row=>row.id),['b']);
  assert.equal(actions.accept.isPending,false);assert.equal(actions.decline.isPending,false);
  assert.ok(invalidations.some(k=>k[0]==='relationships'));
  assert.ok(invalidations.some(k=>k[0]==='social-counts'));
  assert.equal(notices.filter(n=>n.error).length,1);
  const action=notices.find(n=>n.action).action;
  const cancelled=actions.cancel.mutateAsync(b);
  const cancelFailure=assert.rejects(cancelled,/offline/);
  await new Promise(resolve=>setImmediate(resolve));
  runtime.sessionIdentity.generation++;cache.clear();
  const oldNotices=notices.length,oldInvalidations=invalidations.length;
  pending.get('b').reject(new Error('offline'));await cancelFailure;
  action.onPress();
  assert.equal(cache.size,0);assert.equal(notices.length,oldNotices);assert.equal(invalidations.length,oldInvalidations);assert.equal(routes.length,0);
  await assert.rejects(actions.accept.mutateAsync(a),/unavailable/);
  assert.equal(calls.length,3,'unmounted session must not invoke APIs');
  cache.set(JSON.stringify(key),{incoming:[a],outgoing:[]});
  const fresh=useRequestActions();const retry=fresh.accept.mutateAsync(a);
  await new Promise(resolve=>setImmediate(resolve));pending.get('a').resolve({conversationId:'user:peer-a'});await retry;
  assert.equal(fresh.accept.isPending,false);
});

test('collection loading terminates repeated pages and invalid counts, preserves cancellation and handles successful pagination', async () => {
  const axios=require('axios');
  let requests=[], transport;
  const errors=load('src/services/errors.ts');
  const backend=load('src/services/api/backend.ts',{
    './apiClient':{apiClient:{get:async(url,options)=>{requests.push(options);return {data:{data:await transport(options)}};}}},
    '../errors':errors,'@/config/env':{env:{apiUrl:'https://api.example.test'}},
  });
  const rows=Array.from({length:50},(_,i)=>({_id:String(i)}));
  transport=async()=>({users:rows,count:200});
  await assert.rejects(backend.getCollection('/users','users'),/Pagination did not advance/);
  assert.equal(requests.length,2,'a server ignoring skip must not leave a spinner running');
  for(const count of [NaN,-1,'many']){
    transport=async()=>({users:rows,count});requests=[];
    await assert.rejects(backend.getCollection('/users','users'),error=>error.code==='UNKNOWN');
    assert.equal(requests.length,1);
  }
  const signal=new AbortController().signal;
  requests=[];transport=async({params})=>({users:params.skip===0?rows:[{_id:'last'}],count:51});
  assert.equal((await backend.getCollection('/users','users',signal)).length,51);
  assert.ok(requests.every(options=>options.signal===signal));
  const cancelled=new axios.CanceledError('screen closed');
  transport=async()=>{throw cancelled;};
  await assert.rejects(backend.getData('/users',undefined,signal),error=>error===cancelled);
  assert.throws(()=>backend.unwrap({statusCode:503,error:'unavailable'}),error=>error.code==='UNKNOWN');
  assert.throws(()=>backend.unwrap({statusCode:400,error:'invalid'}),error=>error.code==='VALIDATION');
  const {queryClient}=load('src/services/queryClient.ts',{'./errors':errors});
  const retry=queryClient.getDefaultOptions().queries.retry;
  assert.equal(retry(0,cancelled),false);
  assert.equal(retry(0,new errors.ServiceError('NETWORK')),true);
  queryClient.clear();
});

test('request reads propagate screen cancellation to both endpoints and cancellation writes normalize network errors', async () => {
  const seen=[], errors=load('src/services/errors.ts');
  const {realRequestsService}=load('src/features/requests/services/requestsService.real.ts',{
    '@/services/api/backend':{getData:async(url,_params,signal)=>{seen.push({url,signal});return {followRequests:[]};},unwrap:v=>v,serviceError:()=>new errors.ServiceError('NETWORK')},
    '@/services/api/apiClient':{apiClient:{delete:async()=>{throw new Error('offline');}}},
    '@/features/profile/services/profileService.real':{mapProfile:profile=>profile},'@/services/errors':errors,
  });
  const signal=new AbortController().signal;
  await realRequestsService.list(signal);
  assert.equal(seen.length,2);assert.ok(seen.every(call=>call.signal===signal));
  await assert.rejects(realRequestsService.cancel('request'),error=>error.code==='NETWORK');
});

test('profile count loading and failed refreshes expose retry while retaining known counts', () => {
  let countRetries=0,profileRetries=0,user={id:'me',name:'Me'};
  let counts={isPending:true,isError:false,isRefetching:false,refetch:()=>{countRetries++;}};
  const auth=select=>select({user});auth.getState=()=>({refreshProfile:()=>{profileRetries++;}});
  const {MyProfileScreen}=load('src/features/profile/screens/MyProfileScreen.tsx',{
    react:{useState:value=>[value,()=>{}]},'expo-router':{useRouter:()=>({push(){}})},
    'react-native':{RefreshControl:'Refresh',ScrollView:'Scroll',Share:{},View:'View'},
    '@tanstack/react-query':{useQuery:()=>counts},
    '@/components/layout':{Header:'Header',Screen:'Screen',SettingsButton:'Settings'},
    '@/components/ui':{Button:'Button',Loader:'Loader',Modal:'Modal',Text:'Text'},
    '@/components/feedback/ErrorState':{ErrorState:'ErrorState'},
    '@/features/auth/store/authStore':{useAuthStore:auth},
    '@/features/feed/hooks/useFeed':{useMyPosts:()=>({data:[]}),useDeletePost:()=>({}),useToggleLike:()=>({})},
    '@/services/api/backend':{},'@/utils/formatters':{toHandle:value=>value},'@/theme':{spacing:{}},
    '@/theme/useTheme':{useTheme:()=>({theme:{colors:{}}})},
    '../components/EditProfileForm':{EditProfileForm:'Edit'},'../components/ProfileHeader':{ProfileHeader:'ProfileHeader'},'../components/ProfileGrid':{ProfileGrid:'Grid'},
  });
  const flatten=element=>Array.isArray(element)?element.flatMap(flatten):element&&typeof element==='object'?[element,...flatten(element.props?.children)]:[];
  assert.match(JSON.stringify(MyProfileScreen()),/Loading follower counts/);
  counts={...counts,isPending:false,isError:true,data:{followers:4,following:2}};
  const elements=flatten(MyProfileScreen());
  assert.equal(elements.find(node=>node.type==='ProfileHeader').props.followers,4);
  const error=elements.find(node=>node.type==='ErrorState');
  assert.match(error.props.message,/out of date/);error.props.onRetry();assert.equal(countRetries,1);
  counts={...counts,isError:false};
  assert.equal(flatten(MyProfileScreen()).some(node=>node.type==='ErrorState'),false);
  user=null;
  const absent=MyProfileScreen();assert.doesNotMatch(JSON.stringify(absent),/Loader/);
  flatten(absent).find(node=>node.type==='ErrorState').props.onRetry();assert.equal(profileRetries,1);
});

test('Activity request cards share the canonical request cache and actions and expose loading/error recovery', () => {
  const request={id:'request',user:{id:'peer',name:'Peer',avatarUri:'https://avatar.example/picture'}};
  const accepted=[],declined=[],routes=[];let retries=0;
  const query={data:{incoming:[request],outgoing:[]},isPending:false,isError:false,isRefetching:false,refetch:()=>{retries++;}};
  const {FollowRequestsScreen}=load('src/features/activity/screens/ActivityScreen.tsx',{
    '@expo/vector-icons':{Ionicons:'Icon'},
    'react-native':{RefreshControl:'Refresh',View:'View',StyleSheet:{create:value=>value}},
    '@/components/ui/Pressable':{Pressable:'Pressable'},'@shopify/flash-list':{FlashList:'List'},
    '@/theme':{spacing:{},radius:{}},'expo-router':{useRouter:()=>({push:value=>routes.push(value)})},
    '@/components/layout':{Header:'Header',Screen:'Screen'},
    '@/components/ui':{Avatar:'Avatar',Button:'Button',Text:'Text',EmptyState:'Empty',Loader:'Loader'},
    '@/components/feedback/ErrorState':{ErrorState:'ErrorState'},
    '@/features/requests/hooks/useRequests':{useRequests:()=>query,useRequestActions:()=>({accept:{mutate:item=>accepted.push(item)},decline:{mutate:item=>declined.push(item)}})},
    '@/theme/useTheme':{useTheme:()=>({theme:{colors:{}}})},react:{},'./NotificationsScreen':{},
  });
  const flatten=element=>Array.isArray(element)?element.flatMap(flatten):element&&typeof element==='object'?[element,...flatten(element.props?.children)]:[];
  const list=flatten(FollowRequestsScreen()).find(node=>node.type==='List');
  assert.equal(list.props.data,query.data.incoming);
  const card=flatten(list.props.renderItem({item:request}));
  const avatar=card.find(node=>node.type==='Avatar');assert.equal(avatar.props.uri,request.user.avatarUri);
  for(const label of ['Accept','Decline'])card.find(node=>node.type==='Button'&&node.props.label===label).props.onPress();
  assert.equal(accepted[0],request);assert.equal(declined[0],request);
  card.find(node=>node.type==='Pressable').props.onPress();assert.equal(routes[0],'/profile/peer');
  query.isPending=true;assert.ok(flatten(FollowRequestsScreen()).some(node=>node.type==='Loader'));
  query.isPending=false;query.isError=true;
  const error=flatten(FollowRequestsScreen()).find(node=>node.type==='ErrorState');error.props.onRetry();assert.equal(retries,1);
  query.isError=false;query.data={incoming:[],outgoing:[]};
  assert.equal(flatten(FollowRequestsScreen()).find(node=>node.type==='List').props.data.length,0);
});

test('custom PIN records use salted hashes, reject wrong PINs and validate passcode policy', async () => {
  await assert.rejects(credentials.createCredential('1234', crypto.randomBytes(32)), /6 to 12/);
  const a=await credentials.createCredential('123456',crypto.randomBytes(32));
  const b=await credentials.createCredential('123456',crypto.randomBytes(32));
  assert.notEqual(a.hash,b.hash); assert.equal(a.iterations,600000);
  assert.equal(await credentials.checkCredential('123456',a),true);
  assert.equal(await credentials.checkCredential('654321',a),false);
  await assert.rejects(credentials.checkCredential('123456',{...a,iterations:1}),/unavailable/);
});

test('App Lock persists PIN-only mode, verifies changes, protects settings and handles enrollment changes', async () => {
  const data = new Map(); let enrolled = true;
  const secure = { WHEN_UNLOCKED_THIS_DEVICE_ONLY:1,
    getItemAsync:async k=>data.get(k) ?? null,setItemAsync:async(k,v)=>data.set(k,v),deleteItemAsync:async k=>data.delete(k),canUseBiometricAuthentication:()=>enrolled };
  const service = load('src/features/app-lock/service.ts',{
    'expo-secure-store':secure, 'expo-crypto':{getRandomBytes:n=>crypto.randomBytes(n)},
    'expo-local-authentication':{hasHardwareAsync:async()=>true,isEnrolledAsync:async()=>enrolled,authenticateAsync:async()=>({success:enrolled})},
    './credentials':credentials,
  });
  const owner='507f1f77bcf86cd799439011';
  assert.equal(await service.readAppLock(owner),null);
  await service.setAppPin(owner,'123456');
  assert.equal((await service.readAppLock(owner)).biometric,false);
  await assert.rejects(service.setAppPin(owner,'234567','000000'),/Incorrect/);
  await service.setAppPin(owner,'234567','123456');
  await assert.rejects(service.verifyAppPin(owner,'123456'),/Incorrect/);
  await service.verifyAppPin(owner,'234567');
  await service.changeLockSettings(owner,'234567',{timeout:60000,biometric:true});
  assert.equal((await service.readAppLock(owner)).timeout,60000);
  await service.biometricUnlock(owner);
  data.delete('darkfantasy.app-lock.'+owner+'.biometric');
  await assert.rejects(service.biometricUnlock(owner),/changed/);
  enrolled=false; await assert.rejects(service.biometricUnlock(owner),/PIN/);
  await service.verifyAppPin(owner,'234567');
  await service.changeLockSettings(owner,'234567',{biometric:false});
  assert.equal((await service.readAppLock(owner)).biometric,false);
  for(let i=0;i<5;i++) await assert.rejects(service.verifyAppPin(owner,'000000'),/Incorrect/);
  await assert.rejects(service.verifyAppPin(owner,'234567'),/Too many/);
  const config=JSON.parse(data.get('darkfantasy.app-lock.'+owner)); config.retryAt=0;
  data.set('darkfantasy.app-lock.'+owner,JSON.stringify(config));
  await service.changeLockSettings(owner,'234567',{disable:true});
  assert.equal(await service.readAppLock(owner),null);
});

test('auto-lock covers timeout boundaries, clock rollback and immediate locking', () => {
  assert.equal(credentials.lockExpired(null,0,100),false);
  assert.equal(credentials.lockExpired(100,0,100),true);
  assert.equal(credentials.lockExpired(100,1000,1099),false);
  assert.equal(credentials.lockExpired(100,1000,1100),true);
  assert.equal(credentials.lockExpired(100,1000,99),true);
});

test('notification navigation allowlists profile, request, conversation and event targets', () => {
  const {notificationTarget}=load('src/features/activity/notificationTarget.ts');
  const id='507f1f77bcf86cd799439011';
  assert.equal(notificationTarget({conversationId:'user:'+id}),'/chat/user:'+id);
  assert.equal(notificationTarget({profileId:id}),'/profile/'+id);
  assert.equal(notificationTarget({requestId:id}),'/activity');
  assert.equal(notificationTarget({eventId:id}),'/events/'+id);
  for(const data of [{conversationId:'https://evil.example'},{profileId:'../../auth'},{eventId:'invalid'},{}]) assert.equal(notificationTarget(data),undefined);
});

test('screen cancellation and logout each abort a request without cancelling unrelated requests', () => {
  const {requestSignal}=load('src/services/api/requestSignal.ts');
  const session=new AbortController(),a=new AbortController(),b=new AbortController();
  const first=requestSignal(session.signal,a.signal),second=requestSignal(session.signal,b.signal);
  a.abort(); assert.equal(first.signal.aborted,true); assert.equal(second.signal.aborted,false);
  session.abort(); assert.equal(second.signal.aborted,true);
  first.dispose(); second.dispose();
  assert.equal(requestSignal(session.signal,new AbortController().signal).signal.aborted,true);
});

test('message action selection closes the single popup before executing; backdrop and back share close', () => {
  const calls=[];
  const {MessageActionPopup}=load('src/features/chat/components/MessageActionPopup.tsx',{
    '@/components/ui':{BottomSheet:'Sheet',Button:'Button',Text:'Text'},
  });
  const popup=MessageActionPopup({actions:[{text:'Copy',onPress:()=>calls.push('copy')},{text:'Cancel'}],onClose:()=>calls.push('close')});
  popup.props.onClose();
  popup.props.children[1][0].props.onPress();
  popup.props.children[1][1].props.onPress();
  assert.deepEqual(calls,['close','close','copy','close']);
  assert.equal(MessageActionPopup({actions:null,onClose(){}}).props.visible,false);
});

test('the native bottom sheet dismisses on backdrop, hardware back and downward swipe', () => {
  let closed=0, gesture;
  const {BottomSheet}=load('src/components/ui/BottomSheet.tsx',{
    react:{useMemo:fn=>fn()},
    'react-native':{Modal:'Modal',View:'View',StyleSheet:{create:s=>s,absoluteFill:{}},PanResponder:{create:options=>{
      gesture=options;return {panHandlers:{}};
    }}},
    'react-native-keyboard-controller':{KeyboardAvoidingView:'Keyboard'},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},
    '@/components/ui/Pressable':{Pressable:'Pressable'},
    '@/theme':{radius:{},spacing:{}},'@/theme/useTheme':{useTheme:()=>({theme:{colors:{}}})},
  });
  const sheet=BottomSheet({visible:true,onClose:()=>closed++,children:'Actions'});
  sheet.props.onRequestClose();
  sheet.props.children.props.children.props.children[0].props.onPress();
  assert.equal(gesture.onMoveShouldSetPanResponder({}, {dy:20,dx:2}),true);
  gesture.onPanResponderRelease({}, {dy:60,vy:0});
  assert.equal(closed,3);
});

test('App Lock does not mount protected content before hydration, on account mismatch or while locked', () => {
  const effects=[]; let splashHidden=0;
  let state={owner:null,ready:false,locked:true,config:null,error:''};
  const owner='507f1f77bcf86cd799439011';
  const auth={session:{userId:owner},currentUser:{username:'test@example.test'}};
  const hook=selector=>selector(auth);hook.getState=()=>auth;
  const lockHook=()=>state; lockHook.setState=()=>{};
  const {AppLockBoundary}=load('src/features/app-lock/AppLockBoundary.tsx',{
    react:{useEffect:fn=>effects.push(fn),useRef:v=>({current:v}),useState:v=>[v,()=>{}]},
    'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Platform:{OS:'android'},View:'View'},
    '@/components/ui':{Button:'Button',Text:'Text',TextField:'TextField'},
    '@/features/auth/store/authStore':{useAuthStore:hook},
    '@/features/auth/sessionRuntime':{sessionIdentity:{generation:1}},
    '@/features/auth/services/authService.real':{realAuthService:{}},
    'expo-secure-store':{},'expo-splash-screen':{hideAsync:async()=>{splashHidden++;}},
    '@/theme/useTheme':{useTheme:()=>({theme:{colors:{}}})},'@/theme':{spacing:{}},
    './credentials':credentials,'./service':{readAppLock:async()=>null},'./state':{useAppLock:lockHook},
  });
  const render=()=>JSON.stringify(AppLockBoundary({children:'PROTECTED-CONTENT'}));
  assert.doesNotMatch(render(),/PROTECTED-CONTENT/);
  effects.length=0;
  state={...state,owner,ready:true};assert.doesNotMatch(render(),/PROTECTED-CONTENT/);
  effects.forEach(fn=>fn());assert.equal(splashHidden,1,'native splash must not cover PIN entry');
  state={...state,locked:false};assert.match(render(),/PROTECTED-CONTENT/);
  state={...state,owner:'another-account'};assert.doesNotMatch(render(),/PROTECTED-CONTENT/);
});

const { aesAdapter } = require('./test-support/crypto.cjs');
test('photo encryption round-trips actual AES-GCM, changes ciphertext, and rejects tampering or another resource', async () => {
  const data=new Map();
  const encryption=load('src/features/vault/photoEncryption.ts',{
    'expo-crypto':aesAdapter(),'expo-secure-store':{getItemAsync:async k=>data.get(k),setItemAsync:async(k,v)=>data.set(k,v)},
  });
  const bytes=Uint8Array.of(255,216,255,1,2,3,4,5);
  const a=await encryption.encryptPhoto('owner','photo',bytes),b=await encryption.encryptPhoto('owner','photo',bytes);
  assert.equal(encryption.encryptedPhoto(a),true);assert.notDeepEqual(a,b);
  assert.deepEqual(await encryption.decryptPhoto('owner','photo',a),bytes);
  await assert.rejects(encryption.decryptPhoto('owner','different-photo',a));
  await assert.rejects(encryption.decryptPhoto('another-owner','photo',a));
  a[a.length-1]^=1; await assert.rejects(encryption.decryptPhoto('owner','photo',a));
});

test('backup messages require both verified encryption and cloud acknowledgment and never claim a missing local copy is safe', () => {
  const {backupStatus}=load('src/features/vault/backupStatus.ts');
  const photo={kind:'photo',localPath:'private',localEncrypted:1,syncState:'pending_upload'};
  assert.equal(backupStatus(photo),'Encrypted and saved locally. Cloud backup pending.');
  assert.equal(backupStatus({...photo,syncState:'failed'}),'Backup could not be completed. Your encrypted local copy is safe. Retry backup.');
  assert.equal(backupStatus({...photo,syncState:'synced',status:'approved',s3Key:'remote',remoteEncrypted:true}),'Encrypted and securely backed up.');
  assert.equal(backupStatus({...photo,syncState:'synced',status:'approved',s3Key:'legacy'}),'Encrypted locally. Cloud backup saved; cloud encryption verification pending.');
  for(const changes of [{localEncrypted:0},{localPath:null},{kind:'video'}]) assert.doesNotMatch(backupStatus({...photo,...changes,syncState:'failed'}),/encrypted local copy is safe/);
});
