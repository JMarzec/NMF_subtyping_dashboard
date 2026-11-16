import {expect,test} from "bun:test";
import {oauthReturnPath} from "./oauthReturnPath";
test("preserve consent query and fragment; reject external return paths",()=>{
 expect(oauthReturnPath('/.lovable/oauth/consent?authorization_id=123#consent')).toBe('/.lovable/oauth/consent?authorization_id=123#consent');
 for(const path of ['//external.example','/\\external.example','/\nexternal.example','https://external.example','///external.example'])expect(oauthReturnPath(path)).toBe('/');
});